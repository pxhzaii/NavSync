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

  // ????
  const passwordMode = ref(false)
  const passwordInput = ref(getStoredPassword())
  const passwordAuthed = ref(isPasswordAuthed())

  // ????
  const isConnected = ref(false)
  const connectError = ref('')

  // ????(?????? / ????)
  const isLocked = ref(false)
  const lockRemainingSec = ref(0)
  const passwordHint = ref('')
  let lockTimer: ReturnType<typeof setInterval> | null = null

  // ?????
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
    passwordHint.value = ''
  }

  function formatLockTime(sec: number): string {
    if (sec >= 60) {
      const min = Math.floor(sec / 60)
      const s = sec % 60
      return s > 0 ? `${min} ? ${s} ?` : `${min} ??`
    }
    return `${sec} ?`
  }

  /**
   * ?????????(?????? API ????)
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

    // ???????,??????(?? Token ???)
    if (!status.passwordMode) {
      const user = await fetchUserInfo()
      if (user.valid) {
        username.value = user.username || ''
      }
    }

    isConnecting.value = false
    window.$message?.success('?????????', { duration: 3000 })
  }

  /**
   * ??????
   */
  async function verifyPassword() {
    const pwd = passwordInput.value.trim()

    // ????????
    if (isLocked.value) {
      window.$message?.warning(`????,? ${formatLockTime(lockRemainingSec.value)} ???`, { duration: 3000 })
      return
    }

    const result = await validatePassword(pwd)
    if (result.valid) {
      passwordAuthed.value = true
      cloudStatus.value = getCloudStatus()
      passwordInput.value = ''
      stopLockCountdown()
      passwordHint.value = ''
      window.$message?.success('??????', { duration: 3000 })
    }
    else {
      passwordAuthed.value = false
      // ??:???????
      if (result.locked && result.retryAfterSec) {
        startLockCountdown(result.retryAfterSec)
        passwordHint.value = result.error || '??????,?????'
        window.$message?.error(passwordHint.value, { duration: 5000 })
      }
      // ????:??????
      else if (result.remaining !== undefined) {
        passwordHint.value = result.error || '???????'
        if (result.remaining > 0) {
          window.$message?.error(`?????,?? ${result.remaining} ???`, { duration: 4000 })
        }
        else {
          // ?????(remaining=0 ???? locked ?,? 15 ???)
          startLockCountdown(15 * 60)
          window.$message?.error('????????,??? 15 ??', { duration: 5000 })
        }
      }
      else {
        passwordHint.value = result.error || '??????'
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
      window.$message?.success('????????', { duration: 3000 })
    }
    else {
      window.$message?.error(result.error || '????', { duration: 3000 })
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
      // ?????:??????????
      if (!Array.isArray(cloudData.data) || typeof cloudData.settings !== 'object' || cloudData.settings === null) {
        window.$message?.error('????????,??????', { duration: 3000 })
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

      window.$message?.success('??????????', { duration: 3000 })
    }
    else {
      window.$message?.error(result.error || '????', { duration: 3000 })
    }
  }

  function handleDisconnect() {
    if (!window.confirm('?????????????????????')) {
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
    window.$message?.success('???????', { duration: 3000 })
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