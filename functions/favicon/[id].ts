/**
 * GET /favicon/{domain}.png - 网站图标代理（Pages Functions + KV 缓存）
 *
 * 工作流程：
 *   1. 请求到达 → 先查 KV 缓存，命中直接返回（含正确的 Content-Type）
 *   2. 未命中 → 后端代理请求第三方图标源（Google / DuckDuckGo / 0x3）
 *   3. 成功 → 写入 KV 缓存（默认 30 天）并返回；失败 → 返回 5xx，前端降级为首字母
 *
 * 并发保护：
 *   - 同一域名的并发回源请求单飞（in-flight 去重），仅回源一次后共享结果
 *
 * 前置条件（Cloudflare Pages Dashboard 配置）：
 *   - KV namespace 绑定：binding 名称必须为 FAVICON_KV
 *     Pages 项目 → Settings → Bindings → KV namespace → 变量名填 FAVICON_KV
 *   - 环境变量（可选）：
 *     FAVICON_SOURCE  - 图标源：google（默认）/ duckduckgo / 0x3
 *     FAVICON_TTL     - 缓存时长（秒），范围 60 ~ 2592000，默认 2592000（30 天）
 */
import type { Env } from '../_shared'

/** Pages Functions 环境（在原 Env 基础上增加 KV 绑定） */
export interface FaviconEnv extends Env {
  FAVICON_KV: KVNamespace
  FAVICON_SOURCE?: string
  FAVICON_TTL?: string
}

/** 缓存元数据（随 KV metadata 存储，用于缓存命中时还原正确的 Content-Type） */
interface CacheMeta {
  contentType: string
}

/** Cloudflare KV expirationTtl 合法范围（秒） */
const TTL_MIN = 60
const TTL_MAX = 2_592_000 // 30 天（KV 上限）
const DEFAULT_TTL = 2_592_000

/** 回源超时 */
const UPSTREAM_TIMEOUT_MS = 8_000

/** CDN 缓存响应头（浏览器缓存 1 天） */
const CACHE_HEADER = 'public, max-age=86400, s-maxage=86400'

/** 合法域名格式（防止恶意 URL / SSRF 探测） */
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/

/** 校验 token 是否为合法的域名（小写） */
function sanitizeDomain(token: string): string | null {
  const domain = token.replace(/\.(png|ico|svg|jpe?g)$/i, '').toLowerCase()
  if (domain.length > 253 || !DOMAIN_RE.test(domain))
    return null

  return domain
}

/** 钳制 TTL 到 KV 合法范围（[60, 2592000]），非法输入回落默认值 */
function clampTtl(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0)
    return DEFAULT_TTL

  return Math.min(Math.max(raw, TTL_MIN), TTL_MAX)
}

/** 生成图标源 URL（支持多个上游，便于故障切换） */
function buildFaviconUrl(source: string, domain: string): string {
  switch (source) {
    case 'duckduckgo':
      return `https://icons.duckduckgo.com/ip3/${domain}.ico`
    case '0x3':
      return `https://0x3.com/icon?host=${domain}`
    case 'google':
    default:
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
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

/** 回源第三方并写入 KV 缓存，返回图标数据与 Content-Type */
async function fetchAndCache(
  kv: KVNamespace,
  key: string,
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

  // 写入 KV（失败不影响本次响应，只是不缓存）
  await kv.put(key, buffer, { expirationTtl: ttl, metadata: { contentType } }).catch(() => {})

  return { buffer, contentType }
}

/** 同域名并发回源单飞（in-flight 去重，防缓存击穿） */
const inflight = new Map<string, Promise<{ buffer: ArrayBuffer; contentType: string }>>()

export const onRequestGet: PagesFunction<FaviconEnv> = async (context) => {
  const { env, params } = context
  const token = String((params as Record<string, string>).id || '')

  // 1. 校验 token 是否为合法域名
  const domain = sanitizeDomain(token)
  if (!domain)
    return new Response('Bad Request', { status: 400 })

  const kv = env.FAVICON_KV
  const kvKey = `favicon:${domain}`
  const ttl = clampTtl(Number(env.FAVICON_TTL) || DEFAULT_TTL)

  // 2. 查 KV 缓存（带 metadata，命中时返回正确的 Content-Type）
  try {
    const { value, metadata } = await kv.getWithMetadata<CacheMeta>(kvKey, 'arrayBuffer')
    if (value) {
      return new Response(value, {
        headers: {
          'Content-Type': metadata?.contentType || 'image/x-icon',
          'Cache-Control': CACHE_HEADER,
        },
      })
    }
  }
  catch {
    // KV 读取失败不阻塞，继续走回源
  }

  // 3. 回源第三方图标服务（同一域名并发请求共享同一次回源）
  const source = env.FAVICON_SOURCE || 'google'
  const upstreamUrl = buildFaviconUrl(source, domain)
  const inflightKey = `${source}:${domain}`

  let pending = inflight.get(inflightKey)
  if (!pending) {
    pending = fetchAndCache(kv, kvKey, upstreamUrl, ttl).finally(() => {
      inflight.delete(inflightKey)
    })
    inflight.set(inflightKey, pending)
  }

  try {
    const { buffer, contentType } = await pending
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': CACHE_HEADER,
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
