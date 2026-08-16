import type { Search, SettingItem } from '@/types'

export type SearchSetting = SettingItem<Search>

export const searchList: SearchSetting[] = [
  {
    name: '百度',
    enName: 'Baidu',
    value: { name: '百度', enName: 'Baidu', url: 'https://www.baidu.com/s', key: 'wd', favicon: '/svg/baidu.svg' },
  },
  {
    name: '必应',
    enName: 'Bing',
    value: { name: '必应', enName: 'Bing', url: 'https://www.bing.com/search', key: 'q', favicon: '/svg/bing.svg' },
  },
  {
    name: '谷歌',
    enName: 'Google',
    value: { name: '谷歌', enName: 'Google', url: 'https://www.google.com/search', key: 'q', favicon: '/svg/google.svg' },
  },
  {
    name: '搜狗',
    enName: 'Sogou',
    value: { name: '搜狗', enName: 'Sogou', url: 'https://www.sogou.com/web', key: 'query', favicon: '/svg/sogou.svg' },
  },
  {
    name: '维基',
    enName: 'Wikipedia',
    value: { name: '维基百科', enName: 'Wikipedia', url: 'https://zh.wikipedia.org/w/index.php', key: 'search', favicon: '/svg/wikipedia.svg' },
  },
]
