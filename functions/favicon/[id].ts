/**
 * GET /favicon/{domain}.png - 网站图标代理（Pages Functions + 边缘缓存）
 *
 * 工作流程：
 *   1. 请求到达 → 先查 Cloudflare 边缘缓存（Cache API），命中直接返回
 *   2. 未命中 → 后端代理请求第三方图标源（DuckDuckGo / 0x3 / Google）
 *   3. 成功 → 写入边缘缓存并返回；失败 → 返回 5xx，前端降级为首字母
 *
 * 优势：
 *   - 零配置：无需手动创建 KV 命名空间，部署即用
 *   - 边缘缓存：利用 Cloudflare Cache API，按边缘节点缓存
 *
 * 并发保护：
 *   - 同一域名的并发回源请求单飞（in-flight 去重），仅回源一次后共享结果
 *
 * 环境变量（可选，在 Cloudflare Pages Dashboard > Settings > Environment variables 中设置）：
 *   FAVICON_SOURCE  - 图标源：duckduckgo（默认）/ 0x3 / google
 *   FAVICON_TTL     - 缓存时长（秒），范围 60 ~ 86400，默认 86400（1 天）
 */
import type { Env } from '../_shared'

/** Pages Functions 环境（在原 Env 基础上增加可选配置） */
export interface FaviconEnv extends Env {
  FAVICON_SOURCE?: string
  FAVICON_TTL?: string
}

/** Cloudflare Cache API TTL 合法范围（秒） */
const TTL_MIN = 60
const TTL_MAX = 86_400 // 1 天（Cache API 上限）
const DEFAULT_TTL = 86_400

/** 回源超时 */
const UPSTREAM_TIMEOUT_MS = 8_000

/** 合法域名格式（防止恶意 URL / SSRF 探测） */
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/

/** 校验 token 是否为合法的域名（小写） */
function sanitizeDomain(token: string): string | null {
  const domain = token.replace(/\.(png|ico|svg|jpe?g)$/i, '').toLowerCase()
  if (domain.length > 253 || !DOMAIN_RE.test(domain))
    return null

  return domain
}

/** 钳制 TTL 到合法范围（[60, 86400]），非法输入回落默认值 */
function clampTtl(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0)
    return DEFAULT_TTL

  return Math.min(Math.max(raw, TTL_MIN), TTL_MAX)
}

/** 生成图标源 URL（支持多个上游，便于故障切换） */
function buildFaviconUrl(source: string, domain: string): string {
  switch (source) {
    case 'google':
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    case '0x3':
      return `https://0x3.com/icon?host=${domain}`
    case 'duckduckgo':
    default:
      return `https://icons.duckduckgo.com/ip3/${domain}.ico`
  }
}

/**
 * 携带超时的 fetch
 * 注：与 _shared.ts 中的 fetchWithTimeout 实现相似但语义不同——
 *     _shared 版本面向 GitHub API（10s、可传 RequestInit），
 *     本版本面向第三方图标源（8s、固定 GET），故单独保留，不强行合并。
 */
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  }
  finally {
    clearTimeout(timer)
  }
}

/** 回源失败（携带 HTTP 状态码，供上层返回 502/504） */
class UpstreamError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** 构造缓存 key（使用 Request URL） */
function buildCacheKey(url: string): Request {
  return new Request(url, { method: 'GET' })
}

/** 回源第三方并写入边缘缓存，返回图标数据与 Content-Type */
async function fetchAndCache(
  cache: Cache,
  cacheKey: Request,
  url: string,
  ttl: number,
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const upstream = await fetchWithTimeout(url, UPSTREAM_TIMEOUT_MS)

  if (!upstream.ok)
    throw new UpstreamError(upstream.status, `Upstream ${upstream.status}`)

  const contentType = upstream.headers.get('Content-Type') || 'image/x-icon'
  const buffer = await upstream.arrayBuffer()
  if (buffer.byteLength === 0)
    throw new UpstreamError(502, 'Empty favicon')

  // 写入边缘缓存（失败不影响本次响应，只是不缓存）
  const cachedResponse = new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
    },
  })
  await cache.put(cacheKey, cachedResponse).catch(() => {})

  return { buffer, contentType }
}

/** 同域名并发回源单飞（in-flight 去重，防缓存击穿） */
const inflight = new Map<string, Promise<{ buffer: ArrayBuffer; contentType: string }>>()

export const onRequestGet: PagesFunction<FaviconEnv> = async (context) => {
  const { env, params, request } = context
  const token = String((params as Record<string, string>).id || '')

  // 1. 校验 token 是否为合法域名
  const domain = sanitizeDomain(token)
  if (!domain)
    return new Response('Bad Request', { status: 400 })

  const ttl = clampTtl(Number(env.FAVICON_TTL) || DEFAULT_TTL)
  const cacheKey = buildCacheKey(request.url)

  // 2. 查边缘缓存
  const cache = caches.default
  try {
    const cached = await cache.match(cacheKey)
    if (cached) {
      return new Response(cached.body, {
        headers: {
          'Content-Type': cached.headers.get('Content-Type') || 'image/x-icon',
          'Cache-Control': cached.headers.get('Cache-Control') || `public, max-age=${ttl}`,
        },
      })
    }
  }
  catch {
    // 缓存读取失败不阻塞，继续走回源
  }

  // 3. 回源第三方图标服务（同一域名并发请求共享同一次回源）
  const source = env.FAVICON_SOURCE || 'duckduckgo'
  const upstreamUrl = buildFaviconUrl(source, domain)
  const inflightKey = `${source}:${domain}`

  let pending = inflight.get(inflightKey)
  if (!pending) {
    pending = fetchAndCache(cache, cacheKey, upstreamUrl, ttl).finally(() => {
      inflight.delete(inflightKey)
    })
    inflight.set(inflightKey, pending)
  }

  try {
    const { buffer, contentType } = await pending
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
      },
    })
  }
  catch (err: any) {
    if (err?.name === 'AbortError')
      return new Response('Favicon source timeout', { status: 504 })

    const status = typeof err?.status === 'number' ? err.status : 502
    return new Response('Favicon fetch failed', { status })
  }
}
