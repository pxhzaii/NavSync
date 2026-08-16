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

/** GET /api/download - 从 GitHub Gist 下载配置 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 口令校验
    const authFail = checkPassword(context.request, context.env)
    if (authFail)
      return authFail

    if (!context.env.GITHUB_TOKEN)
      return jsonResponse({ error: '服务端未配置 GitHub Token' }, 500)

    const url = new URL(context.request.url)
    const gistId = url.searchParams.get('gistId')
    if (!gistId)
      return jsonResponse({ error: '缺少 gistId 参数' }, 400)

    // Gist ID 只允许字母数字，防止路径注入
    if (!/^[a-f0-9]+$/i.test(gistId))
      return jsonResponse({ error: '无效的 gistId' }, 400)

    const res = await fetchWithTimeout(`${GIST_API_URL}/${gistId}`, {
      headers: gistHeaders(context.env.GITHUB_TOKEN),
    })

    if (!res.ok) {
      if (res.status === 404)
        return jsonResponse({ error: '云端数据已被删除' }, 404)

      return jsonResponse({ error: `下载失败 (HTTP ${res.status})` }, 500)
    }

    const gist = await res.json<any>()
    const file = gist.files?.[GIST_FILE]
    if (!file?.content)
      return jsonResponse({ error: '云端数据为空或格式异常' }, 500)

    let cloudData
    try {
      cloudData = JSON.parse(file.content)
    }
    catch {
      return jsonResponse({ error: '云端数据格式损坏，无法解析' }, 500)
    }
    return jsonResponse({ success: true, data: cloudData })
  }
  catch (err: any) {
    return handleError(err)
  }
}
