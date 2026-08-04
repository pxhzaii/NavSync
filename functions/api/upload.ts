import {
  jsonResponse,
  readBody,
  checkPassword,
  gistHeaders,
  fetchWithTimeout,
  handleError,
  GIST_API_URL,
  GIST_FILE,
  type Env,
} from '../_shared'

/** POST /api/upload - 上传配置到 GitHub Gist */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.GITHUB_TOKEN) {
      return jsonResponse({ error: '服务端未配置 GitHub Token' }, 500)
    }

    // 口令校验（在读取请求体之前，fail fast）
    const authFail = checkPassword(context.request, context.env)
    if (authFail) return authFail

    const body = await readBody<{ data: any; settings: any; gistId?: string }>(context.request)

    const cloudData = {
      data: body.data,
      settings: body.settings,
      updatedAt: new Date().toISOString(),
      version: 1,
    }

    const headers = gistHeaders(context.env.GITHUB_TOKEN)

    if (body.gistId) {
      // Gist ID 只允许字母数字，防止路径注入
      if (!/^[a-f0-9]+$/i.test(body.gistId)) {
        return jsonResponse({ error: '无效的 gistId' }, 400)
      }

      // 更新已有 Gist
      const res = await fetchWithTimeout(`${GIST_API_URL}/${body.gistId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          files: { [GIST_FILE]: { content: JSON.stringify(cloudData, null, 2) } },
        }),
      })

      if (res.ok) {
        const gist = await res.json<any>()
        return jsonResponse({ success: true, gistId: gist.id })
      }

      if (res.status === 404) {
        // Gist 已被删除，创建新的
        return await createGist(cloudData, headers)
      }

      const err = await res.json().catch(() => ({})) as Record<string, string>
      return jsonResponse({ error: err?.message || `上传失败 (HTTP ${res.status})` }, 500)
    }

    // 创建新 Gist
    return await createGist(cloudData, headers)
  }
  catch (err: any) {
    return handleError(err)
  }
}

async function createGist(cloudData: any, headers: Record<string, string>): Promise<Response> {
  const res = await fetchWithTimeout(GIST_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      description: 'COME COME Navigation Config - 云端同步数据',
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify(cloudData, null, 2) } },
    }),
  })
  if (res.ok) {
    const gist = await res.json<any>()
    if (!gist.id) {
      return jsonResponse({ error: 'GitHub 返回数据异常，缺少 Gist ID' }, 500)
    }
    return jsonResponse({ success: true, gistId: gist.id })
  }
  const err = await res.json().catch(() => ({})) as Record<string, string>
  return jsonResponse({ error: err?.message || `创建 Gist 失败 (HTTP ${res.status})` }, 500)
}
