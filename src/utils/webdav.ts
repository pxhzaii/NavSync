import type { Category, Settings } from '@/types'

/**
 * WebDAV 备份（支持代理 / 直连两种模式）
 *
 * 原理：
 *   - 代理模式：浏览器调用自建代理（如 keyvault-webdav-proxy），代理转发到
 *     目标 WebDAV 服务器（如坚果云 dav.jianguoyun.com），避免 CF-to-CF 520
 *   - 直连模式：代理地址留空时，浏览器直接请求目标 WebDAV（需服务器支持 CORS）
 *   - 数据以 JSON 格式备份到 WebDAV 的指定路径（默认 /navsync-backup.json）
 */

export const WEBDAV_PROXY = 'https://webdav.5as.cn/api/webdav'
export const WEBDAV_DEFAULT_PATH = '/navsync/backup.json'

/** 代理允许转发的目标域名白名单（来自 keyvault-webdav-proxy 源码） */
const ALLOWED_HOSTS = [
  'dav.jianguoyun.com',
  'webdav.pcloud.com',
  'webdav.hidrive.strato.com',
  'dav.infini-cloud.net',
]

/** UTF-8 安全的 Base64 编码（btoa 无法处理中文等非 Latin-1 字符） */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** 本地存储 key */
const KEY_WEBDAV_URL = 'webdav_url'
const KEY_USER = 'webdav_user'
const KEY_PASSWORD = 'webdav_password'
const KEY_WEBDAV_PATH = 'webdav_path'
const KEY_PROXY = 'webdav_proxy'
const KEY_LAST_BACKUP = 'webdav_last_backup'

export interface WebDavConfig {
  serverUrl: string
  username: string
  password: string
  filePath: string
  /** 代理地址，留空表示直连 WebDAV */
  proxy: string
}

export interface WebDavBackupData {
  data: Category[]
  settings: Settings
  updatedAt: string
  source: 'navsync-webdav'
}

type WebDavBackup = WebDavBackupData

export function getWebDavConfig(): WebDavConfig {
  return {
    serverUrl: localStorage.getItem(KEY_WEBDAV_URL) || '',
    username: localStorage.getItem(KEY_USER) || '',
    password: localStorage.getItem(KEY_PASSWORD) || '',
    filePath: localStorage.getItem(KEY_WEBDAV_PATH) || WEBDAV_DEFAULT_PATH,
    proxy: localStorage.getItem(KEY_PROXY) || WEBDAV_PROXY,
  }
}

export function setWebDavConfig(config: Partial<WebDavConfig>) {
  if (config.serverUrl !== undefined)
    localStorage.setItem(KEY_WEBDAV_URL, config.serverUrl)
  if (config.username !== undefined)
    localStorage.setItem(KEY_USER, config.username)
  if (config.password !== undefined)
    localStorage.setItem(KEY_PASSWORD, config.password)
  if (config.filePath !== undefined)
    localStorage.setItem(KEY_WEBDAV_PATH, normalizeFilePath(config.filePath))
  if (config.proxy !== undefined)
    localStorage.setItem(KEY_PROXY, config.proxy)
}

export function getWebDavLastBackup(): string {
  return localStorage.getItem(KEY_LAST_BACKUP) || ''
}

export function setWebDavLastBackup(time: string) {
  localStorage.setItem(KEY_LAST_BACKUP, time)
}

/** 清除本地保存的全部 WebDAV 配置 */
export function clearWebDavStorage() {
  localStorage.removeItem(KEY_WEBDAV_URL)
  localStorage.removeItem(KEY_USER)
  localStorage.removeItem(KEY_PASSWORD)
  localStorage.removeItem(KEY_WEBDAV_PATH)
  localStorage.removeItem(KEY_PROXY)
  localStorage.removeItem(KEY_LAST_BACKUP)
}

/** 规范化备份路径：确保路径含至少一层子目录
 *  坚果云等 WebDAV 不允许直接在 /dav/ 根下放文件（返回 404），
 *  需先创建子目录再 PUT。若路径在根目录下（如 /backup.json），
 *  自动放入 /navsync/ 子目录。
 */
export function normalizeFilePath(filePath: string): string {
  const clean = filePath.trim().replace(/\/{2,}/g, '/').replace(/\/+$/, '').replace(/^\/+/, '')
  const segments = clean.split('/').filter(Boolean)
  if (segments.length === 0)
    return '/navsync/backup.json'
  if (segments.length === 1)
    return `/navsync/${segments[0]}`
  return `/${clean}`
}

/** 构建 WebDAV 完整 URL（统一规范：base 无尾斜杠 + path 单前导斜杠，消除双斜杠差异） */
function buildWebDavUrl(serverUrl: string, filePath: string): string {
  let base = serverUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(base))
    base = `https://${base}`
  // 路径规范化：去掉重复斜杠与尾部斜杠，统一单前导斜杠
  const cleanPath = filePath.trim().replace(/\/{2,}/g, '/').replace(/\/+$/, '').replace(/^\/+/, '')
  if (!cleanPath)
    return base
  return `${base}/${cleanPath}`
}

/** 提取备份路径的父目录列表（不含文件名），如 /a/b/f.json → ['/a', '/a/b'] */
function getParentDirs(filePath: string): string[] {
  const clean = filePath.trim().replace(/\/{2,}/g, '/').replace(/\/+$/, '')
  const segments = clean.split('/').filter(Boolean)
  if (segments.length <= 1)
    return [] // 根目录下，无需创建父目录
  const dirs: string[] = []
  let cur = ''
  for (let i = 0; i < segments.length - 1; i++) {
    cur += `/${segments[i]}`
    dirs.push(cur)
  }
  return dirs
}

/** 逐级创建备份路径的父目录（MKCOL），全部就绪返回空串，失败返回错误信息 */
async function ensureParentDirs(config: WebDavConfig): Promise<string> {
  const dirs = getParentDirs(config.filePath)
  if (dirs.length === 0)
    return ''
  const base = buildWebDavUrl(config.serverUrl, '')
  for (const dir of dirs) {
    const res = await webDavFetch(`${base}${dir}`, 'MKCOL', config.username, config.password, config.proxy)
    if (res.status >= 200 && res.status < 300)
      continue // 创建成功
    if (res.status === 405 || res.status === 301 || res.status === 302)
      continue // 目录已存在
    if (res.status === 409)
      continue // 部分服务端对已存在目录也返回 409，继续尝试
    return `父目录创建失败: ${dir} (HTTP ${res.status})`
  }
  return ''
}

/** 校验 serverUrl 是否合法（仅代理模式下做白名单校验） */
function validateServerUrl(serverUrl: string, proxy: string): string {
  const base = serverUrl.trim().replace(/\/+$/, '')
  const host = base.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase()
  // 直连模式不做白名单限制，只要求填了地址
  if (!proxy.trim()) {
    if (!host)
      return '请填写正确的 WebDAV 服务器地址'
    return ''
  }
  if (!ALLOWED_HOSTS.includes(host))
    return `服务器地址不在代理白名单内（支持: ${ALLOWED_HOSTS.join(', ')}）`
  return ''
}

/** 调用 WebDAV（代理模式走 keyvault-webdav-proxy，直连模式直接请求目标） */
interface ProxyResponse {
  status: number
  headers?: Record<string, string>
  bodyB64?: string
  error?: string
}

/** ArrayBuffer → base64（直连 GET 时复用） */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function webDavFetch(url: string, method: string, username: string, password: string, proxy: string, body?: string): Promise<ProxyResponse> {
  const headers = new Headers()
  headers.set('Authorization', `Basic ${utf8ToBase64(`${username}:${password}`)}`)
  if (body !== undefined)
    headers.set('Content-Type', 'application/octet-stream')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)
  try {
    // 代理模式：统一 POST 到代理，目标地址与方法放在 query
    if (proxy) {
      const proxyUrl = `${proxy}?url=${encodeURIComponent(url)}&method=${encodeURIComponent(method)}`
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers,
        body: body !== undefined ? body : undefined,
        signal: controller.signal,
      })
      const data = await res.json() as ProxyResponse
      return data
    }
    // 直连模式：直接请求目标 WebDAV
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? body : undefined,
      signal: controller.signal,
    })
    if (method === 'GET' || method === 'HEAD') {
      const buf = await res.arrayBuffer()
      return { status: res.status, bodyB64: arrayBufferToBase64(buf) }
    }
    return { status: res.status }
  }
  catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? '请求超时，请检查网络或代理服务' : '网络错误，无法连接 WebDAV')
  }
  finally {
    clearTimeout(timeoutId)
  }
}

/** 测试 WebDAV 连接（读取目标文件，成功即配置可用） */
export async function testWebDavConnection(config: WebDavConfig): Promise<{ ok: boolean; error?: string; notice?: string }> {
  try {
    const url = buildWebDavUrl(config.serverUrl, config.filePath)
    const hostErr = validateServerUrl(config.serverUrl, config.proxy)
    if (hostErr)
      return { ok: false, error: hostErr }
    const result = await webDavFetch(url, 'GET', config.username, config.password, config.proxy)
    if (result.status >= 200 && result.status < 300)
      return { ok: true }
    if (result.status === 401 || result.status === 403)
      return { ok: false, error: '用户名或密码错误（401/403）' }
    if (result.status === 404 || result.status === 409) {
      // 404：文件不存在；409：父目录不存在（坚果云等对 GET 不存在的子路径也返回 409）
      // 均视为连接正常，顺便预创建父目录
      const mkErr = await ensureParentDirs(config)
      if (mkErr)
        return { ok: true, notice: `连接正常，但父目录异常：${mkErr}` }
      return { ok: true, notice: '连接正常（备份文件尚不存在，父目录已就绪，可直接备份）' }
    }
    return { ok: false, error: `连接失败 (HTTP ${result.status})` }
  }
  catch (e: any) {
    return { ok: false, error: e?.message || '连接失败' }
  }
}

/** 备份配置到 WebDAV（PUT 覆盖写入） */
export async function backupToWebDav(data: Category[], settings: Settings, config: WebDavConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const url = buildWebDavUrl(config.serverUrl, config.filePath)
    const hostErr = validateServerUrl(config.serverUrl, config.proxy)
    if (hostErr)
      return { success: false, error: hostErr }
    const body = JSON.stringify({
      data,
      settings,
      updatedAt: new Date().toISOString(),
      source: 'navsync-webdav',
    } satisfies WebDavBackup)
    let res = await webDavFetch(url, 'PUT', config.username, config.password, config.proxy, body)

    // 404/409：父目录可能不存在或路径冲突，自动逐级创建父目录后重试一次
    if (res.status === 404 || res.status === 409) {
      const mkErr = await ensureParentDirs(config)
      if (mkErr)
        return { success: false, error: mkErr }
      res = await webDavFetch(url, 'PUT', config.username, config.password, config.proxy, body)
    }

    if (res.status >= 200 && res.status < 300) {
      setWebDavLastBackup(new Date().toLocaleString())
      return { success: true }
    }
    if (res.status === 404)
      return { success: false, error: '备份失败 (HTTP 404)：目标路径的父目录不存在或无法访问，请检查备份路径' }
    if (res.status === 409)
      return { success: false, error: '备份失败 (HTTP 409)：目标位置存在同名文件夹或目录冲突，请更换备份路径' }
    if (res.status === 429)
      return { success: false, error: '备份失败 (HTTP 429)：请求过于频繁，请稍后再试' }
    return { success: false, error: `备份失败 (HTTP ${res.status})` }
  }
  catch (e: any) {
    return { success: false, error: e?.message || '备份失败' }
  }
}

/** 从 WebDAV 恢复配置（GET 读取） */
export async function restoreFromWebDav(config: WebDavConfig): Promise<{ success: boolean; data?: WebDavBackup; error?: string }> {
  try {
    const url = buildWebDavUrl(config.serverUrl, config.filePath)
    const hostErr = validateServerUrl(config.serverUrl, config.proxy)
    if (hostErr)
      return { success: false, error: hostErr }
    const res = await webDavFetch(url, 'GET', config.username, config.password, config.proxy)
    if (res.status === 404)
      return { success: false, error: '云端备份不存在，请先执行一次备份' }
    if (res.status !== 200)
      return { success: false, error: `恢复失败 (HTTP ${res.status})` }
    if (!res.bodyB64)
      return { success: false, error: '备份数据为空' }

    // base64 解码
    const raw = atob(res.bodyB64)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++)
      bytes[i] = raw.charCodeAt(i)
    const text = new TextDecoder().decode(bytes)
    const data = JSON.parse(text) as WebDavBackup

    // 防御性校验
    if (!Array.isArray(data.data) || Array.isArray(data.settings) || typeof data.settings !== 'object' || data.settings === null)
      return { success: false, error: '备份数据格式异常' }

    return { success: true, data }
  }
  catch (e: any) {
    if (e instanceof SyntaxError)
      return { success: false, error: '备份数据损坏，无法解析' }
    return { success: false, error: e?.message || '恢复失败' }
  }
}

/** 从服务端 /api/webdav-config 拉取预设配置，仅填充本地未设置的字段 */
export async function fetchServerWebDavConfig(): Promise<Partial<WebDavConfig>> {
  try {
    const password = localStorage.getItem('cloud_password') || ''
    const headers: Record<string, string> = {}
    if (password)
      headers['X-Cloud-Password'] = password
    const res = await fetch('/api/webdav-config', { headers })
    if (!res.ok)
      return {}
    const data = await res.json() as { config?: Record<string, string> }
    if (!data.config || typeof data.config !== 'object')
      return {}
    // 只返回服务端有值的字段（密码仅在服务端启用访问口令保护时才会返回）
    const result: Partial<WebDavConfig> = {}
    if (data.config.serverUrl)
      result.serverUrl = data.config.serverUrl
    if (data.config.username)
      result.username = data.config.username
    if (data.config.password)
      result.password = data.config.password
    if (data.config.filePath)
      result.filePath = data.config.filePath
    if (data.config.proxy !== undefined)
      result.proxy = data.config.proxy
    return result
  }
  catch {
    return {}
  }
}
