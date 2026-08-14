import {
  uploadToCloud,
  downloadFromCloud,
  validatePassword,
  fetchCloudStatus,
  fetchUserInfo,
  clearCloudStorage,
  getCloudStatus,
  isPasswordAuthed,
  getStoredPassword,
} from '@/utils/cloud'

export const useCloudStore = defineStore('cloud', () => {
  const isUploading = ref(false)
  const isDownloading = ref(false)
  const isConnecting = ref(false)
  const lastSyncTime = ref(localStorage.getItem('cloud_last_sync') || '')
  const cloudStatus = ref(getCloudStatus())
  const username = ref('')

  // 口令相关
  const passwordMode = ref(false)
  const passwordInput = ref(getStoredPassword())
  const passwordAuthed = ref(isPasswordAuthed())

  // 连接状态
  const isConnected = ref(false)
  const connectError = ref('')

  // 限流提示（口令错误次数 / 锁定状态）
  const isLocked = ref(false)
  const lockRemainingSec = ref(0)
  const passwordHint = ref('')
  let lockTimer: ReturnType<typeof setInterval> | null = null

  // 锁定倒计时
  function startLockCountdown(seconds: number) {
    stopLockCountdown()
    isLocked.value = true
    lockRemainingSec.value = seconds
    lockTimer = setInterval(() => {
      lockRemainingSec.value -= 1
      if (lockRemainingSec.value <= 0) {
        stopLockCountdown()
      }
    }, 1000)
  }

  function stopLockCountdown() {
    if (lockTimer) {
      clearInterval(lockTimer)
      lockTimer = null
    }
    isLocked.value = false
    lockRemainingSec.value = 0
  }

  function formatLockTime(sec: number): string {
    if (sec >= 60) {
      const min = Math.floor(sec / 60)
      const s = sec % 60
      return s > 0 ? `${min} 分 ${s} 秒` : `${min} 分钟`
    }
    return `${sec} 秒`
  }

  /**
   * 连接到云端同步服务（自动检测同域 API 是否可用）
   */
  async function connectToCloud() {
    isConnecting.value = true
    connectError.value = ''

    const status = await fetchCloudStatus()
    if (status.error) {
      connectError.value = status.error
      isConnected.value = false
      isConnecting.value = false
      return
    }

    passwordMode.value = status.passwordMode
    isConnected.value = true
    cloudStatus.value = getCloudStatus()

    // 如果非口令模式，获取用户信息（验证 Token 有效性）
    if (!status.passwordMode) {
      const user = await fetchUserInfo()
      if (user.valid) {
        username.value = user.username || ''
      }
    }

    isConnecting.value = false
    window.$message?.success('云端同步服务已连接', { duration: 3000 })
  }

  /**
   * 验证访问口令
   */
  async function verifyPassword() {
    const pwd = passwordInput.value.trim()

    // 锁定期间禁止尝试
    if (isLocked.value) {
      window.$message?.warning(`已被锁定，请 ${formatLockTime(lockRemainingSec.value)} 后再试`, { duration: 3000 })
      return
    }

    const result = await validatePassword(pwd)
    if (result.valid) {
      passwordAuthed.value = true
      cloudStatus.value = getCloudStatus()
      passwordInput.value = ''
      stopLockCountdown()
      passwordHint.value = ''
      window.$message?.success('口令验证成功', { duration: 3000 })
    }
    else {
      passwordAuthed.value = false
      // 锁定：显示封禁倒计时
      if (result.locked && result.retryAfterSec) {
        startLockCountdown(result.retryAfterSec)
        passwordHint.value = result.error || '尝试次数过多，请稍后再试'
        window.$message?.error(passwordHint.value, { duration: 5000 })
      }
      // 口令错误：显示剩余次数
      else if (result.remaining !== undefined) {
        passwordHint.value = result.error || '访问口令不正确'
        if (result.remaining > 0) {
          window.$message?.error(`口令不正确，还有 ${result.remaining} 次机会`, { duration: 4000 })
        }
        else {
          // 后端已锁定（remaining=0 但未返回 locked 时，按 15 分钟算）
          startLockCountdown(15 * 60)
          window.$message?.error('口令错误次数过多，已锁定 15 分钟', { duration: 5000 })
        }
      }
      else {
        passwordHint.value = result.error || '口令验证失败'
        window.$message?.error(passwordHint.value, { duration: 3000 })
      }
    }
  }

  async function handleUpload() {
    const siteStore = useSiteStore()
    const settingStore = useSettingStore()

    isUploading.value = true
    const result = await uploadToCloud(
      toRaw(siteStore.data),
      toRaw(settingStore.settings),
    )
    isUploading.value = false

    if (result.success) {
      const now = new Date().toLocaleString()
      localStorage.setItem('cloud_last_sync', now)
      lastSyncTime.value = now
      cloudStatus.value = getCloudStatus()
      window.$message?.success('配置已同步至云端', { duration: 3000 })
    }
    else {
      window.$message?.error(result.error || '上传失败', { duration: 3000 })
    }
  }

  async function handleDownload() {
    const siteStore = useSiteStore()
    const settingStore = useSettingStore()

    isDownloading.value = true
    const result = await downloadFromCloud()
    isDownloading.value = false

    if (result.success && result.data) {
      const cloudData = result.data
      // 防御性校验：确保云端数据格式正确
      if (!Array.isArray(cloudData.data) || typeof cloudData.settings !== 'object' || cloudData.settings === null) {
        window.$message?.error('云端数据格式异常，无法恢复配置', { duration: 3000 })
        return
      }
      siteStore.setData(cloudData.data)
      settingStore.setSettings(cloudData.settings)

      toggleTheme(cloudData.settings.theme)
      toggleSiteSytle()
      siteStore.cateIndex = 0

      const now = new Date().toLocaleString()
      localStorage.setItem('cloud_last_sync', now)
      lastSyncTime.value = now

      window.$message?.success('已从云端拉取最新配置', { duration: 3000 })
    }
    else {
      window.$message?.error(result.error || '下载失败', { duration: 3000 })
    }
  }

  function handleDisconnect() {
    if (!window.confirm('确定要断开云端同步吗？断开后需要重新验证。')) {
      return
    }
    clearCloudStorage()
    username.value = ''
    lastSyncTime.value = ''
    passwordInput.value = ''
    passwordAuthed.value = false
    isConnected.value = false
    connectError.value = ''
    cloudStatus.value = getCloudStatus()
    stopLockCountdown()
    passwordHint.value = ''
    window.$message?.success('已断开云端同步', { duration: 3000 })
  }

  return {
    isUploading,
    isDownloading,
    isConnecting,
    lastSyncTime,
    cloudStatus,
    username,
    passwordMode,
    passwordInput,
    passwordAuthed,
    isConnected,
    connectError,
    passwordHint,
    isLocked,
    lockRemainingSec,
    formatLockTime,
    connectToCloud,
    verifyPassword,
    handleUpload,
    handleDownload,
    handleDisconnect,
  }
})