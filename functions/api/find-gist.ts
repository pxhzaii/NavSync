import {
  type Env,
  GIST_API_URL,
  GIST_FILE,
  checkPassword,
  fetchWithTimeout,
  gistHeaders,
  handleError,
  jsonResponse,
} from '../_shared'

/** GET /api/find-gist - 查找当前用户已有的配置 Gist */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 口令校验
    const authFail = checkPassword(context.request, context.env)
    if (authFail)
      return authFail

    if (!context.env.GITHUB_TOKEN)
      return jsonResponse({ error: '服务端未配置 GitHub Token' }, 500)

    // 列出用户的所有 Gist（分页遍历最多 3 页，每页 100 条，覆盖 300 条）
    const headers = gistHeaders(context.env.GITHUB_TOKEN)
    let page = 1
    const maxPages = 3
    let gists: any[] = []

    while (page <= maxPages) {
      const res = await fetchWithTimeout(`${GIST_API_URL}?per_page=100&page=${page}`, {
        headers,
      })

      if (!res.ok)
        return jsonResponse({ error: `查询 Gist 失败 (HTTP ${res.status})` }, 500)

      const batch = await res.json<any[]>()
      gists = gists.concat(batch)

      // 不足 100 条说明已是最后一页
      if (batch.length < 100)
        break

      page++
    }
    // 查找包含 navsync-config.json 文件的 Gist
    const found = gists.find((g: any) => g.files && g.files[GIST_FILE])

    if (found)
      return jsonResponse({ found: true, gistId: found.id })

    return jsonResponse({ found: false })
  }
  catch (err: any) {
    return handleError(err)
  }
}
