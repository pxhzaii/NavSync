import {
  jsonResponse,
  checkPassword,
  gistHeaders,
  fetchWithTimeout,
  handleError,
  GIST_API_URL,
  GIST_FILE,
  type Env,
} from '../_shared'

/** GET /api/find-gist - 查找当前用户已有的配置 Gist */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 口令校验
    const authFail = checkPassword(context.request, context.env)
    if (authFail) return authFail

    if (!context.env.GITHUB_TOKEN) {
      return jsonResponse({ error: '服务端未配置 GitHub Token' }, 500)
    }

    // 列出用户的所有 Gist（每页 100 条，取第一页即可）
    const res = await fetchWithTimeout(`${GIST_API_URL}?per_page=100`, {
      headers: gistHeaders(context.env.GITHUB_TOKEN),
    })

    if (!res.ok) {
      return jsonResponse({ error: `查询 Gist 失败 (HTTP ${res.status})` }, 500)
    }

    const gists = await res.json<any[]>()
    // 查找包含 comecome-config.json 文件的 Gist
    const found = gists.find((g: any) => g.files && g.files[GIST_FILE])

    if (found) {
      return jsonResponse({ found: true, gistId: found.id })
    }
    return jsonResponse({ found: false })
  }
  catch (err: any) {
    return handleError(err)
  }
}
