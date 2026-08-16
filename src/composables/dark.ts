import { usePreferredColorScheme } from '@vueuse/core'
import type { DarkMode } from '@/types'

export const isDark = useDark()
export const toggleDark = useToggle(isDark)

// 模块级提升：避免 usePreferredColorScheme 在条件分支内每次调用叠加监听器（内存泄漏）
const preferredColorScheme = usePreferredColorScheme()

export function useSiteStyle() {
  const settingStore = useSettingStore()
  const siteStyle = computed(() => (settingStore.getSettingItem('siteStyle').value as DarkMode).enName as string)

  return {
    siteStyle,
  }
}

export function toggleSiteStyle() {
  const { siteStyle } = useSiteStyle()
  if (siteStyle.value === 'auto') {
    if (preferredColorScheme.value === 'light')
      isDark.value = false
    else if (preferredColorScheme.value === 'dark')
      isDark.value = true
  }
  else if (siteStyle.value === 'dark') {
    isDark.value = true
  }
  else {
    isDark.value = false
  }
}

// 向后兼容旧函数名，避免遗漏引用
export const toggleSiteSytle = toggleSiteStyle
