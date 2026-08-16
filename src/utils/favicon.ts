// 图标获取统一走本站 Pages Functions 代理（/favicon/{domain}.png），
// 由后端请求第三方源（DuckDuckGo / 0x3 / Google）并写入 KV 缓存，
// 避免浏览器直连第三方接口的跨域与稳定性问题。
const FAVICON_API = '/favicon/'

const siteToUrl: Map<string, string> = new Map()
const sites: string[] = [
  'clougence.com',
  'jd.com',
  'taobao.com',
  'pinduoduo.com',
]

sites.forEach((e: string) => {
  siteToUrl.set(e, `/site/${e}.svg`)
})

function getDomainName(url: string) {
  let domain = url.replace(/(^\w+:|^)\/\//, '')
  domain = domain.replace(/^www\./, '')

  const matches = domain.match(/([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/)

  if (matches && matches.length > 1)
    return matches[1]

  return null
}

export function getFaviconUrl(url: string) {
  const paramsUrl = getDomainName(url)
  if (paramsUrl == null)
    return ''

  const optUrl = siteToUrl.get(paramsUrl)
  if (optUrl)
    return optUrl

  return `${FAVICON_API + paramsUrl}.png`
}
