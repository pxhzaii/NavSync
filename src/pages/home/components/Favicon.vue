<script setup lang="ts">
import type { PropType } from 'vue'
import { getFaviconUrl, getRandomDarkColor } from '@/utils'
import type { Site } from '@/types'

const props = defineProps({
  site: {
    type: Object as PropType<Site>,
    required: true,
  },
})

const { iconStyle } = useIconStyle()

const isGen = ref(false)
const imgLoaded = ref(false)

// 组件实例复用时（列表更新/切换 site），重置图片加载状态，避免旧站点的状态残留
watch(() => props.site, () => {
  isGen.value = false
  imgLoaded.value = false
})

function handleFaviconError(site: Site) {
  isGen.value = true
  // 直接修改响应式 site 对象（其已在 store 数据中，天然响应式），
  // 避免依赖全局 cateIndex/groupIndex/siteIndex 造成多站点并发加载时的索引竞争
  if (site.bgColor)
    return
  site.bgColor = getRandomDarkColor()
}
</script>

<template>
  <div :style="iconStyle" h-18 w-18 md="h-22 w-22" lg="h-22 w-22">
    <div v-if="!isGen && !imgLoaded" bg="$setting-group-bg-c" h-full w-full animate-pulse rounded-full />
    <img
      v-if="!isGen"
      :src="site.favicon || getFaviconUrl(site.url)"
      h-full w-full
      decoding="async"
      loading="lazy"
      :style="{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }"
      @error="handleFaviconError(site)"
      @load="imgLoaded = true"
    >
    <div v-else :style="{ backgroundColor: site.bgColor }" h-full w-full flex-center scale-112 rounded-full text="white sm">
      {{ site.name.length > 0 ? site.name.toLocaleUpperCase().charAt(0) : 'c' }}
    </div>
  </div>
</template>
