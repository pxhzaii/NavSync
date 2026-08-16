import type { Category, Settings } from '@/types'

/**
 * WebDAV 备份（通过 keyvault-webdav-proxy 代理访问坚果云等 WebDAV 服务）
 *
 * 原理：
 *   - 浏览器直接调用自建代理 https://webdav.5as.cn/api/webdav
 *   - 代理将请求转发到目标 WebDAV 服务器（如坚果云 dav.jianguoyun.com），
 *     避免 CF-to-CF 520 问题
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
const KEY_LAST_BACKUP = 'webdav_last_backup'

export interface WebDavConfig {
  serverUrl: string
  username: string
  password: string
  filePath: string
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

/** 校验 serverUrl 是否为代理白名单域名（避免 405/无效转发） */
function validateServerUrl(serverUrl: string): string {
  const base = serverUrl.trim().replace(/\/+$/, '')
  const host = base.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase()
  if (!ALLOWED_HOSTS.includes(host))
    return `服务器地址不在代理白名单内（支持: ${ALLOWED_HOSTS.join(', ')}）`
  return ''
}

/** 调用 WebDAV 代理（返回包装 JSON） */
interface ProxyResponse {
  status: number
  headers?: Record<string, string>
  bodyB64?: string
  error?: string
}

async function proxyFetch(url: string, method: string, username: string, password: string, body?: string): Promise<ProxyResponse> {
  const headers = new Headers()
  headers.set('Authorization', `Basic ${utf8ToBase64(`${username}:${password}`)}`)
  if (body !== undefined)
    headers.set('Content-Type', 'application/octet-stream')

  // 通过代理 URL 传递目标地址与方法
  const proxyUrl = `${WEBDAV_PROXY}?url=${encodeURIComponent(url)}&method=${encodeURIComponent(method)}`
  const init: RequestInit = {
    method: 'POST', // 代理统一用 POST（实际方法在 query 里）
    headers,
    body: body !== undefined ? body : undefined,
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(proxyUrl, { ...init, signal: controller.signal })
    const data = await res.json() as ProxyResponse
    return data
  }
  catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? '请求超时，请检查网络或代理服务' : '网络错误，无法连接 WebDAV 代理')
  }
  finally {
    clearTimeout(timeoutId)
  }
}

/** 测试 WebDAV 连接（读取目标文件，成功即配置可用） */
export async function testWebDavConnection(config: WebDavConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = buildWebDavUrl(config.serverUrl, config.filePath)
    const hostErr = validateServerUrl(config.serverUrl)
    if (hostErr)
      return { ok: false, error: hostErr }
    const result = await proxyFetch(url, 'GET', config.username, config.password)
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
    const hostErr = validateServerUrl(config.serverUrl)
    if (hostErr)
      return { success: false, error: hostErr }
    const body = JSON.stringify({
      data,
      settings,
      updatedAt: new Date().toISOString(),
      source: 'navsync-webdav',
    } satisfies WebDavBackup)
    const res = await proxyFetch(url, 'PUT', config.username, config.password, body)
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
    const hostErr = validateServerUrl(config.serverUrl)
    if (hostErr)
      return { success: false, error: hostErr }
    const res = await proxyFetch(url, 'GET', config.username, config.password)
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
