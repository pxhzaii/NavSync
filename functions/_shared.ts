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
}

const GIST_API = 'https://api.github.com/gists'
const GIST_FILENAME = 'comecome-config.json'
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
  if (contentLength && Number(contentLength) > MAX_BODY_SIZE) {
    throw new Error('请求体过大')
  }
  const body = await request.json<T>()
  const str = JSON.stringify(body)
  if (str.length > MAX_BODY_SIZE) {
    throw new Error('请求体过大')
  }
  return body
}

/** GitHub API 请求头（必须带 User-Agent，否则 403） */
export function gistHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'comecome-cloud-sync',
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

/** 口令校验：通过返回 null，不通过返回 Response */
export function checkPassword(request: Request, env: Env): Response | null {
  if (!env.CLOUD_PASSWORD) {
    return null // 未设置口令，跳过校验
  }
  const pwd = request.headers.get('X-Cloud-Password')
  if (pwd !== env.CLOUD_PASSWORD) {
    return jsonResponse({ error: '访问口令不正确' }, 403)
  }
  return null
}

/** 统一错误处理 */
export function handleError(err: any): Response {
  const msg = err?.name === 'AbortError'
    ? 'GitHub API 响应超时，请稍后重试'
    : (err?.message || 'Internal Server Error')
  return jsonResponse({ error: msg }, 500)
}
