<script setup lang="ts">
import type { PropType } from 'vue'
import { getFaviconUrl, getRandomDarkColor } from '@/utils'
import { Site } from '@/types';

const props = defineProps({
  site: {
    type: Object as PropType<Site>,
    required: true,
  },
})

const { iconStyle } = useIconStyle()

const isGen = ref(false)
const imgLoaded = ref(false)

// ???????(????/?? site),????????,??????????
watch(() => props.site, () => {
  isGen.value = false
  imgLoaded.value = false
})

function handleFaviconError(site: Site) {
  isGen.value = true
  // ??????? site ??(??? store ???,?????),
  // ?????? cateIndex/groupIndex/siteIndex ???????????????
  if (site.bgColor)
    return
  site.bgColor = getRandomDarkColor()
}
</script>

<template>
  <div :style="iconStyle" h-18 w-18 md="h-22 w-22" lg="h-22 w-22">
    <div v-if="!isGen && !imgLoaded" h-full w-full rounded-full bg="$setting-group-bg-c" animate-pulse />
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
      {{ site.name.length > 0 ? site.name.toLocaleUpperCase().charAt(0) : 'c'}}
    </div>
  </div>
</template>
