import { jsonResponse, readBody, handleError, type Env } from '../_shared'

/** POST /api/verify-password - 验证访问口令 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await readBody<{ password?: string }>(context.request)

    if (!context.env.CLOUD_PASSWORD) {
      return jsonResponse({ valid: true })
    }
    if (!body.password) {
      return jsonResponse({ valid: false, error: '请输入访问口令' }, 400)
    }
    if (body.password !== context.env.CLOUD_PASSWORD) {
      return jsonResponse({ valid: false, error: '访问口令不正确' }, 403)
    }
    return jsonResponse({ valid: true })
  }
  catch (err: any) {
    return handleError(err)
  }
}
