import { jsonResponse, type Env } from '../_shared'

/** GET /api/status - 返回是否启用口令模式 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const passwordMode = !!context.env.CLOUD_PASSWORD
  return jsonResponse({ passwordMode })
}
