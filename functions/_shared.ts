/**
 * 云端同步 Pages Functions 共享工具
 *
 * 环境变量（在 Cloudflare Pages Dashboard > Settings > Environment variables 中设置）：
 *   GITHUB_TOKEN    - GitHub Personal Access Token（仅需 gist 权限）
 *   CLOUD_PASSWORD  - 访问口令（留空则不启用口令保护）
 */

/** Cloudflare Pages 环境变量接口 */
export interface Env {
  GITHUB_TOKEN: string
  CLOUD_PASSWORD?: string
  WEBDAV_SERVER_URL?: string
  WEBDAV_USERNAME?: string
  WEBDAV_PASSWORD?: string
  WEBDAV_FILE_PATH?: string
  WEBDAV_PROXY?: string
}

const GIST_API = 'https://api.github.com/gists'
const GIST_FILENAME = 'navsync-config.json'
const MAX_BODY_SIZE = 512 * 1024 // 512 KB
const GITHUB_TIMEOUT_MS = 10_000

/** 带超时的 fetch */
export async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  }
  finally {
    clearTimeout(timeoutId)
  }
}

/** 读取请求体并检查大小限制 */
export async function readBody<T>(request: Request): Promise<T> {
  const contentLength = request.headers.get('Content-Length')
  if (contentLength && Number(contentLength) > MAX_BODY_SIZE)
    throw new Error('请求体过大')

  const body = await request.json<T>()
  const str = JSON.stringify(body)
  if (str.length > MAX_BODY_SIZE)
    throw new Error('请求体过大')

  return body
}

/** GitHub API 请求头（必须带 User-Agent，否则 403） */
export function gistHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'navsync-cloud-sync',
  }
}

export const GIST_API_URL = GIST_API
export const GIST_FILE = GIST_FILENAME

/** JSON 响应 */
export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 统一错误处理 */
export function handleError(err: any): Response {
  const msg = err?.name === 'AbortError'
    ? 'GitHub API 响应超时，请稍后重试'
    : (err?.message || 'Internal Server Error')
  return jsonResponse({ error: msg }, 500)
}

// ---------- 暴力破解防护（内存限流） ----------
// 注意：内存计数按 Cloudflare 隔离实例独立，分布式 IP 池可绕过低频率尝试。
// 如需真正跨实例统一计数，需绑定独立 KV 做持久化计数（当前限流计数仅在内存中）。

const MAX_ATTEMPTS = 5 // 窗口内最多失败 5 次
const WINDOW_MS = 5 * 60 * 1000 // 窗口：5 分钟
const LOCK_MS = 15 * 60 * 1000 // 锁定时长：15 分钟

interface AttemptRecord {
  count: number
  firstFailAt: number
  lockedUntil: number
}

const attempts = new Map<string, AttemptRecord>()

function getClientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('x-real-ip') || 'unknown'
}

function isLocked(ip: string): { locked: boolean; retryAfterSec: number } {
  const rec = attempts.get(ip)
  if (!rec)
    return { locked: false, retryAfterSec: 0 }
  const now = Date.now()
  if (rec.lockedUntil > now)
    return { locked: true, retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1000) }

  // 锁定已过期，清除记录
  if (rec.lockedUntil > 0)
    attempts.delete(ip)

  return { locked: false, retryAfterSec: 0 }
}

function recordFailure(ip: string): { remaining: number } {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec) {
    attempts.set(ip, { count: 1, firstFailAt: now, lockedUntil: 0 })
    return { remaining: MAX_ATTEMPTS - 1 }
  }
  // 窗口已过期，重置计数
  if (now - rec.firstFailAt > WINDOW_MS) {
    rec.count = 1
    rec.firstFailAt = now
    rec.lockedUntil = 0
    return { remaining: MAX_ATTEMPTS - 1 }
  }
  rec.count += 1
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCK_MS
    return { remaining: 0 }
  }
  return { remaining: MAX_ATTEMPTS - rec.count }
}

function recordSuccess(ip: string) {
  attempts.delete(ip)
}

/**
 * 口令校验（所有 API 端点统一使用）：
 * 1. 未设置 CLOUD_PASSWORD → 跳过校验
 * 2. 校验 X-Cloud-Password 头与 CLOUD_PASSWORD 是否一致
 * 3. 所有失败（含口令错误）都计入失败次数，超过阈值锁 IP
 * 通过返回 null，不通过返回 Response
 */
export function checkPassword(request: Request, env: Env): Response | null {
  if (!env.CLOUD_PASSWORD)
    return null // 未设置口令，跳过校验

  const ip = getClientIp(request)

  // 限流检查：锁定期内直接拒绝
  const lock = isLocked(ip)
  if (lock.locked) {
    return jsonResponse({
      error: `尝试次数过多，请 ${lock.retryAfterSec} 秒后再试`,
      locked: true,
      retryAfterSec: lock.retryAfterSec,
    }, 429)
  }

  const pwd = request.headers.get('X-Cloud-Password')
  if (pwd !== env.CLOUD_PASSWORD) {
    // 口令缺失或错误 → 计入失败，返回剩余次数
    const { remaining } = recordFailure(ip)
    return jsonResponse({
      error: '访问口令不正确',
      remaining,
    }, 403)
  }

  // 口令正确 → 清除该 IP 的失败记录
  recordSuccess(ip)
  return null
}
