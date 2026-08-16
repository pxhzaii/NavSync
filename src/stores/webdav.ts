import {
  WEBDAV_DEFAULT_PATH,
  backupToWebDav,
  clearWebDavStorage,
  getWebDavConfig,
  getWebDavLastBackup,
  restoreFromWebDav,
  setWebDavConfig,
  setWebDavLastBackup,
  testWebDavConnection,
} from '@/utils/webdav'
import type { WebDavConfig } from '@/utils/webdav'

export const useWebDavStore = defineStore('webdav', () => {
  // 表单状态
  const serverUrl = ref('')
  const username = ref('')
  const password = ref('')
  const filePath = ref(WEBDAV_DEFAULT_PATH)
  const proxy = ref('')

  // 操作状态
  const isTesting = ref(false)
  const isBackingUp = ref(false)
  const isRestoring = ref(false)
  const lastBackup = ref(getWebDavLastBackup())

  // 初始化时回填本地保存的配置（密码不自动回填，避免明文常驻内存/输入框）
  const saved = getWebDavConfig()
  serverUrl.value = saved.serverUrl
  username.value = saved.username
  filePath.value = saved.filePath || WEBDAV_DEFAULT_PATH
  proxy.value = saved.proxy

  function getConfig(): WebDavConfig {
    return {
      serverUrl: serverUrl.value.trim(),
      username: username.value.trim(),
      password: password.value,
      filePath: filePath.value.trim() || WEBDAV_DEFAULT_PATH,
      proxy: proxy.value.trim(),
    }
  }

  function saveConfig() {
    setWebDavConfig({
      serverUrl: serverUrl.value,
      username: username.value,
      password: password.value,
      filePath: filePath.value,
      proxy: proxy.value,
    })
  }

  function validate(): string {
    if (!serverUrl.value.trim())
      return '请填写 WebDAV 服务器地址'
    if (!username.value.trim())
      return '请填写用户名'
    if (!password.value)
      return '请填写密码'
    return ''
  }

  async function handleTest() {
    const err = validate()
    if (err) {
      window.$message?.warning(err, { duration: 3000 })
      return
    }
    isTesting.value = true
    const result = await testWebDavConnection(getConfig())
    isTesting.value = false
    if (result.ok) {
      saveConfig()
      window.$message?.success('WebDAV 连接成功', { duration: 3000 })
    }
    else {
      window.$message?.error(result.error || '连接失败', { duration: 3000 })
    }
  }

  async function handleBackup() {
    const err = validate()
    if (err) {
      window.$message?.warning(err, { duration: 3000 })
      return
    }
    const siteStore = useSiteStore()
    const settingStore = useSettingStore()

    isBackingUp.value = true
    const result = await backupToWebDav(
      toRaw(siteStore.data),
      toRaw(settingStore.settings),
      getConfig(),
    )
    isBackingUp.value = false

    if (result.success) {
      saveConfig()
      const now = new Date().toLocaleString()
      setWebDavLastBackup(now)
      lastBackup.value = now
      window.$message?.success('已备份到 WebDAV', { duration: 3000 })
    }
    else {
      window.$message?.error(result.error || '备份失败', { duration: 3000 })
    }
  }

  async function handleRestore() {
    const err = validate()
    if (err) {
      window.$message?.warning(err, { duration: 3000 })
      return
    }
    // 恢复会覆盖本地配置，属破坏性操作，先二次确认
    window.$dialog?.warning({
      title: '从 WebDAV 恢复',
      content: '恢复将覆盖当前本地配置，确定继续吗？',
      positiveText: '确定恢复',
      negativeText: '取消',
      onPositiveClick: async () => {
        const siteStore = useSiteStore()
        const settingStore = useSettingStore()

        isRestoring.value = true
        const result = await restoreFromWebDav(getConfig())
        isRestoring.value = false

        if (result.success && result.data) {
          siteStore.setData(result.data.data)
          settingStore.setSettings(result.data.settings)
          toggleTheme(result.data.settings.theme)
          toggleSiteSytle()
          siteStore.cateIndex = 0
          useRenderStore().refreshSiteGroupList()
          saveConfig()
          window.$message?.success('已从 WebDAV 恢复配置', { duration: 3000 })
        }
        else {
          window.$message?.error(result.error || '恢复失败', { duration: 3000 })
        }
      },
    })
  }

  function handleClear() {
    clearWebDavStorage()
    serverUrl.value = ''
    username.value = ''
    password.value = ''
    filePath.value = WEBDAV_DEFAULT_PATH
    proxy.value = ''
    lastBackup.value = ''
    window.$message?.success('已清除 WebDAV 配置', { duration: 3000 })
  }

  return {
    serverUrl,
    username,
    password,
    filePath,
    proxy,
    isTesting,
    isBackingUp,
    isRestoring,
    lastBackup,
    handleTest,
    handleBackup,
    handleRestore,
    handleClear,
  }
})
