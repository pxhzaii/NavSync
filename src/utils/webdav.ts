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
export const WEBDAV_DEFAULT_PATH = '/navsync-backup.json'

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
    localStorage.setItem(KEY_WEBDAV_PATH, config.filePath)
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

/** 构建坚果云 WebDAV 完整 URL（serverUrl 可能带或不带 https:// 与结尾斜杠） */
function buildWebDavUrl(serverUrl: string, filePath: string): string {
  let base = serverUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(base))
    base = `https://${base}`
  const path = filePath.trim().startsWith('/') ? filePath.trim() : `/${filePath.trim()}`
  return base + path
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
export async function testWebDavConnection(config: WebDavConfig): Promise<{ ok: boolean; error?: string }> {
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
    if (result.status === 404)
      return { ok: true } // 文件不存在也视为连接正常（可创建）
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
    const res = await webDavFetch(url, 'PUT', config.username, config.password, config.proxy, body)
    if (res.status >= 200 && res.status < 300) {
      setWebDavLastBackup(new Date().toLocaleString())
      return { success: true }
    }
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
    if (!Array.isArray(data.data) || typeof data.settings !== 'object' || data.settings === null)
      return { success: false, error: '备份数据格式异常' }

    return { success: true, data }
  }
  catch (e: any) {
    if (e instanceof SyntaxError)
      return { success: false, error: '备份数据损坏，无法解析' }
    return { success: false, error: e?.message || '恢复失败' }
  }
}
