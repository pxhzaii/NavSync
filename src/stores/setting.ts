import { iconStyleList, searchList, siteStyleList, themeList } from '@/utils'
import preset from '@/preset.json'
import type { SettingItem, Settings } from '@/types'

export type SettingKey = keyof Settings

export function loadSettings(): Settings | undefined {
  try {
    const settings = localStorage.getItem('settings')
    if (!settings)
      return undefined
    const parsed = JSON.parse(settings)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new Error('settings 数据格式异常')
    return parsed
  }
  catch {
    // 设置数据损坏时清空，回退到默认 preset，避免应用白屏
    localStorage.removeItem('settings')
    return undefined
  }
}

export const settingData: { [K in SettingKey]: SettingItem<any>[] } = {
  theme: themeList,
  search: searchList,
  iconStyle: iconStyleList,
  siteStyle: siteStyleList,
}

export const useSettingStore = defineStore('theme', () => {
  const route = useRoute()
  const isSetting = ref(false)

  watch(route, () => {
    if (route.name === 'setting')
      isSetting.value = true
    else
      isSetting.value = false
  }, { immediate: true })

  const settingCache = loadSettings()
  const presetSetting = preset.settings
  const settings = reactive<Settings>((() => {
    // 始终返回全新对象，避免直接引用 preset.settings 导致后续修改污染模块级常量
    if (settingCache)
      return { ...presetSetting, ...settingCache }
    return { ...presetSetting }
  })())

  function getSettingItem(key: SettingKey) {
    return settingData[key].find(item => item.enName === settings[key]) ?? settingData[key][0]
  }

  function setSettings(newSettings: Partial<Settings>) {
    Object.assign(settings, newSettings)
  }

  watch(settings, () => {
    localStorage.setItem('settings', JSON.stringify(toRaw(settings)))
  }, { deep: true })

  const isDragging = ref(false)
  function setIsDragging(status: boolean) {
    isDragging.value = status
  }

  const isWhiteTheme = computed(() => settings.theme === 'MoonWhite')

  return {
    isWhiteTheme,
    isSetting,
    settings,
    isDragging,
    setSettings,
    setIsDragging,
    getSettingItem,
  }
})
