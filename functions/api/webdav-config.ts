import {
  type Env,
  checkPassword,
  jsonResponse,
} from '../_shared'

/**
 * GET /api/webdav-config - 返回服务端预设的 WebDAV 配置
 *
 * 环境变量（在 Cloudflare Pages Dashboard > Settings > Environment variables 中设置）：
 *   WEBDAV_SERVER_URL  - 服务器地址（如 https://dav.jianguoyun.com/dav）
 *   WEBDAV_USERNAME    - 用户名
 *   WEBDAV_FILE_PATH   - 备份路径（默认 /navsync/backup.json）
 *   WEBDAV_PROXY       - 代理地址（留空则直连）
 *
 * 均为可选项，前端仅在对应字段为空时才用服务端值填充。
 * 需要通过访问口令校验（与云端同步一致）。
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // 口令校验
    const authFail = checkPassword(context.request, context.env)
    if (authFail)
      return authFail

    const config: Record<string, string> = {}

    if (context.env.WEBDAV_SERVER_URL)
      config.serverUrl = context.env.WEBDAV_SERVER_URL
    if (context.env.WEBDAV_USERNAME)
      config.username = context.env.WEBDAV_USERNAME
    // 不返回密码明文，前端需自行输入
    if (context.env.WEBDAV_FILE_PATH)
      config.filePath = context.env.WEBDAV_FILE_PATH
    if (context.env.WEBDAV_PROXY)
      config.proxy = context.env.WEBDAV_PROXY

    return jsonResponse({ config })
  }
  catch (err: any) {
    return jsonResponse({ error: err?.message || 'Internal Server Error' }, 500)
  }
}
