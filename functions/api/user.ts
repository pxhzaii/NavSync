import {
  type Env,
  checkPassword,
  fetchWithTimeout,
  gistHeaders,
  handleError,
  jsonResponse,
} from '../_shared'

/** GET /api/user - 获取 GitHub 用户信息（确认 Token 有效） */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 口令校验
    const authFail = checkPassword(context.request, context.env)
    if (authFail)
      return authFail

    if (!context.env.GITHUB_TOKEN)
      return jsonResponse({ error: '服务端未配置 GitHub Token' }, 500)

    const res = await fetchWithTimeout('https://api.github.com/user', {
      headers: gistHeaders(context.env.GITHUB_TOKEN),
    })
    if (res.ok) {
      const data = await res.json<any>()
      return jsonResponse({ valid: true, username: data.login })
    }
    return jsonResponse({ valid: false, error: 'Token 无效或已过期' }, 401)
  }
  catch (err: any) {
    return handleError(err)
  }
}
