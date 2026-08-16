import type { Category, Settings } from '@/types'

const STORAGE_KEY_GIST_ID = 'cloud_gist_id'
const STORAGE_KEY_PASSWORD = 'cloud_password'
const STORAGE_KEY_AUTHED = 'cloud_authed'

export interface CloudData {
  data: Category[]
  settings: Settings
  updatedAt: string
  version: number
}

// ---------- Gist ID ----------

function getStoredGistId(): string {
  return localStorage.getItem(STORAGE_KEY_GIST_ID) || ''
}

function setStoredGistId(id: string) {
  localStorage.setItem(STORAGE_KEY_GIST_ID, id)
}

// ---------- 口令 ----------

function getStoredPassword(): string {
  return localStorage.getItem(STORAGE_KEY_PASSWORD) || ''
}

function setStoredPassword(password: string) {
  localStorage.setItem(STORAGE_KEY_PASSWORD, password)
}

export function isPasswordAuthed(): boolean {
  return localStorage.getItem(STORAGE_KEY_AUTHED) === 'true'
}

function setPasswordAuthed(authed: boolean) {
  if (authed)
    localStorage.setItem(STORAGE_KEY_AUTHED, 'true')

  else
    localStorage.removeItem(STORAGE_KEY_AUTHED)
}

// ---------- 状态 ----------

export interface CloudStatus {
  hasGistId: boolean
  passwordAuthed: boolean
}

export function clearCloudStorage() {
  localStorage.removeItem(STORAGE_KEY_GIST_ID)
  localStorage.removeItem(STORAGE_KEY_PASSWORD)
  localStorage.removeItem(STORAGE_KEY_AUTHED)
  localStorage.removeItem('cloud_last_sync')
}

// ---------- API 调用（同域，无需配置地址） ----------

async function apiFetch(path: string, init?: RequestInit, password?: string): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json')

  if (password)
    headers.set('X-Cloud-Password', password)

  // 15 秒超时
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)
  try {
    return await fetch(path, { ...init, headers, signal: controller.signal })
  }
  finally {
    clearTimeout(timeoutId)
  }
}

function timeoutMsg(e: any): string {
  return e?.name === 'AbortError' ? '请求超时，请稍后重试' : '网络错误，请检查网络连接'
}

// ---------- 对外接口 ----------

/** 查询服务状态（是否启用口令模式） */
export async function fetchCloudStatus(): Promise<{ passwordMode: boolean; error?: string }> {
  try {
    const res = await apiFetch('/api/status')
    if (!res.ok)
      return { passwordMode: false, error: `请求失败 (HTTP ${res.status})` }

    const data = await res.json() as { passwordMode: boolean }
    return { passwordMode: data.passwordMode }
  }
  catch (e: any) {
    return { passwordMode: false, error: e?.name === 'AbortError' ? '请求超时，请稍后重试' : '无法连接同步服务' }
  }
}

/** 验证访问口令 */
export interface PasswordResult {
  valid: boolean
  error?: string
  /** 剩余尝试次数（口令错误时返回） */
  remaining?: number
  /** 是否被锁定 */
  locked?: boolean
  /** 锁定剩余秒数 */
  retryAfterSec?: number
}

export async function validatePassword(password: string): Promise<PasswordResult> {
  try {
    const res = await apiFetch('/api/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    const data = await res.json() as PasswordResult
    if (data.valid) {
      setStoredPassword(password)
      setPasswordAuthed(true)
    }
    else if (data.valid === false) {
      // 仅在服务端明确返回 valid: false 时才清密码，避免网络异常等误清
      setStoredPassword('')
      setPasswordAuthed(false)
    }
    return data
  }
  catch (e: any) {
    return { valid: false, error: timeoutMsg(e) }
  }
}

/** 上传配置到云端 */
export async function uploadToCloud(data: Category[], settings: Settings): Promise<{ success: boolean; gistId?: string; error?: string }> {
  const password = getStoredPassword()
  let gistId = getStoredGistId()

  // 本地没有 gistId 时，先查找云端是否已有 Gist
  if (!gistId) {
    try {
      const findRes = await apiFetch('/api/find-gist', {
        method: 'GET',
      }, isPasswordAuthed() ? password : undefined)
      const findResult = await findRes.json() as { found: boolean; gistId?: string }
      if (findResult.found && findResult.gistId) {
        gistId = findResult.gistId
        setStoredGistId(gistId)
      }
    }
    catch (e: any) {
      // 查找失败不应静默创建新 Gist，避免产生重复 Gist；提示用户重试
      return { success: false, error: `无法确认云端 Gist 状态：${timeoutMsg(e)}，请重试` }
    }
  }

  try {
    const res = await apiFetch('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ data, settings, gistId: gistId || undefined }),
    }, isPasswordAuthed() ? password : undefined)

    const result = await res.json() as { success: boolean; gistId?: string; error?: string }

    if (result.success && result.gistId)
      setStoredGistId(result.gistId)

    if (!result.success && gistId && res.status === 404)
      localStorage.removeItem(STORAGE_KEY_GIST_ID)

    return result
  }
  catch (e: any) {
    return { success: false, error: timeoutMsg(e) }
  }
}

/** 从云端下载配置 */
export async function downloadFromCloud(): Promise<{ success: boolean; data?: CloudData; error?: string }> {
  let gistId = getStoredGistId()

  // 本地没有 gistId 时，自动从云端查找
  if (!gistId) {
    const password = getStoredPassword()
    try {
      const findRes = await apiFetch('/api/find-gist', {
        method: 'GET',
      }, isPasswordAuthed() ? password : undefined)
      const findResult = await findRes.json() as { found: boolean; gistId?: string }
      if (findResult.found && findResult.gistId) {
        gistId = findResult.gistId
        setStoredGistId(gistId)
      }
      else {
        return { success: false, error: '云端未找到配置数据，请先上传一次配置' }
      }
    }
    catch (e: any) {
      return { success: false, error: timeoutMsg(e) }
    }
  }

  const password = getStoredPassword()

  try {
    const res = await apiFetch(`/api/download?gistId=${encodeURIComponent(gistId)}`, {
      method: 'GET',
    }, isPasswordAuthed() ? password : undefined)

    const result = await res.json() as { success: boolean; data?: CloudData; error?: string }
    return result
  }
  catch (e: any) {
    return { success: false, error: timeoutMsg(e) }
  }
}

/** 获取 GitHub 用户信息（非口令模式验证 Token） */
export async function fetchUserInfo(): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const res = await apiFetch('/api/user')
    const data = await res.json() as { valid: boolean; username?: string; error?: string }
    return data
  }
  catch (e: any) {
    return { valid: false, error: timeoutMsg(e) }
  }
}

/** 获取云端同步状态 */
export function getCloudStatus(): CloudStatus {
  return {
    hasGistId: !!getStoredGistId(),
    passwordAuthed: isPasswordAuthed(),
  }
}

export {
  getStoredGistId,
  setStoredGistId,
  getStoredPassword,
  setStoredPassword,
  setPasswordAuthed,
}
