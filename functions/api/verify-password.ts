import { jsonResponse, readBody, checkPassword, handleError, type Env } from '../_shared'

/** POST /api/verify-password - 验证访问口令（登录时用，body 传 password） */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await readBody<{ password?: string }>(context.request)

    if (!context.env.CLOUD_PASSWORD) {
      return jsonResponse({ valid: true })
    }
    if (!body.password) {
      return jsonResponse({ valid: false, error: '请输入访问口令' }, 400)
    }

    // 把 body 中的口令转为请求头，走统一的 checkPassword（含全端点限流）
    const headers = new Headers(context.request.headers)
    headers.set('X-Cloud-Password', body.password)
    const authedRequest = new Request(context.request.url, { headers })

    const authFail = checkPassword(authedRequest, context.env)
    if (authFail) {
      // 统一限流返回 429 / 口令错误返回 403，转成前端可识别的格式
      const errData = await authFail.json().catch(() => ({})) as Record<string, unknown>
      return jsonResponse({ valid: false, ...errData }, authFail.status)
    }
    return jsonResponse({ valid: true })
  }
  catch (err: any) {
    return handleError(err)
  }
}