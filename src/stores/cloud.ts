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
    const result = await validatePassword(pwd)
    if (result.valid) {
      passwordAuthed.value = true
      cloudStatus.value = getCloudStatus()
      window.$message?.success('口令验证成功', { duration: 3000 })
    }
    else {
      passwordAuthed.value = false
      window.$message?.error(result.error || '口令验证失败', { duration: 3000 })
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
    connectToCloud,
    verifyPassword,
    handleUpload,
    handleDownload,
    handleDisconnect,
  }
})
