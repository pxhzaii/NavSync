import type { Theme } from '@/types'
import { themeList } from '@/utils'
import preset from '@/preset.json'

type ThemeVar = keyof Theme
type ThemeVars<T extends Theme> = { [K in keyof T]: Ref<string> }

const settingsCache = loadSettings()
const defaultTheme: string = settingsCache ? settingsCache.theme : preset.settings.theme

function camelToCssVar(str: string) {
  return `--${str.replace(/[A-Z]|[0-9]+/g, (match: string) => `-${match.toLowerCase()}`)}`
}

// 主题名非法（如云端数据异常）时回退到 themeList 第一项（月白），避免运行时崩溃
const defaultThemeItem = themeList.find(item => item.enName === defaultTheme) ?? themeList[0]
const currentTheme = defaultThemeItem.value
export const themeVars: ThemeVars<Theme> = Object.keys(
  currentTheme).reduce(
  (obj, key) => {
    const cssVar = camelToCssVar(key)
    document.documentElement.style.setProperty(cssVar, currentTheme[key as ThemeVar])
    obj[key as ThemeVar] = useCssVar(cssVar)
    return obj
  },
  {} as Partial<ThemeVars<Theme>>,
) as ThemeVars<Theme>

export function toggleTheme(theme: string) {
  const newTheme = themeList.find(item => item.enName === theme)?.value
  // 非法主题值（如云端数据异常）时回退默认主题，避免 .value 访问 undefined 崩溃
  if (!newTheme)
    return
  for (const key in newTheme) {
    themeVars[key as ThemeVar].value = newTheme[key as ThemeVar]
  }
}
