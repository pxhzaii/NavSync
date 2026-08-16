<script setup lang="ts">
import { vOnClickOutside } from '@vueuse/components'
import $_ from 'lodash'
import type { Search } from '@/types'
import { getFaviconUrl, searchList } from '@/utils'
import searchEngine from '@/utils/search-engine'

const settingStore = useSettingStore()

const keyword = ref('')

const currentIndex = ref(0)

const showKeyDownSel = ref(false)

const noticeKeyList = ref<string[]>([])

const selectedIndex = ref(0)

const searchInputRef = ref<HTMLInputElement>()

function initCurrentIndex() {
  const idx = searchList.findIndex(search => search.enName === settingStore.settings.search)
  currentIndex.value = idx >= 0 ? idx : 0
}

watch(() => settingStore.settings.search, () => {
  initCurrentIndex()
}, { immediate: true })

function search() {
  if (!keyword.value.trim())
    return

  const currentSearch = searchList[currentIndex.value]
  window.open(`${currentSearch.value.url}?${currentSearch.value.key}=${encodeURIComponent(keyword.value)}`)
  clearNoticeKey()
  searchInputRef.value?.blur()
}

function _getFavicon(search: Search) {
  return search.favicon || getFaviconUrl(search.url)
}

function changeSearch(i: number) {
  currentIndex.value = i
  toggleSelection()
}

const selectionVisible = ref(false)

// Don't use 'useClickOutside' because it will still trigger the click event when the selection is closed
function toggleSelection() {
  selectionVisible.value = !selectionVisible.value
}

const { iconStyle } = useIconStyle()

function handleCloseClick() {
  keyword.value = ''
  searchInputRef.value?.focus()
}

function handleKeyDown(_e: KeyboardEvent) {
  // placeholder for keydown events without specific modifier
}

interface Params {
  eng: string
  list: string[]
  wd: string
}

const requestEngApi = $_.debounce(() => {
  const curSearch = searchList[currentIndex.value]
  // 记录当前搜索引擎索引，用于竞态检测：回调返回时若已切换引擎则丢弃
  const capturedIndex = currentIndex.value
  searchEngine.complete(curSearch.enName, keyword.value, (params: Params) => {
    if (keyword.value.trim().length === 0)
      return
    // 竞态保护：搜索引擎已切换则丢弃旧回调结果
    if (currentIndex.value !== capturedIndex)
      return

    noticeKeyList.value.splice(0, noticeKeyList.value.length || 0)
    noticeKeyList.value.push(keyword.value, ...params.list)
  })
}, 100)

function handleInput(_e: Event) {
  if (!keyword.value.trim()) {
    clearNoticeKey()
    return
  }
  showKeyDownSel.value = true
  selectedIndex.value = 0
  requestEngApi()
}

function jumpSearch(i: number) {
  keyword.value = noticeKeyList.value[i]
  search()
}

function clearNoticeKey() {
  showKeyDownSel.value = false
  noticeKeyList.value.splice(0, noticeKeyList.value.length || 0)
  selectedIndex.value = 0
  noticeKeyList.value.push(keyword.value)
}

function keyNext(e: Event) {
  e.preventDefault()
  // 推荐列表为空时直接返回，避免取模 NaN 导致 keyword 被置为 undefined
  if (!noticeKeyList.value.length)
    return
  selectedIndex.value = (selectedIndex.value + 1) % noticeKeyList.value.length || 0
  keyword.value = noticeKeyList.value[selectedIndex.value]
}

function keyPrev(e: Event) {
  e.preventDefault()
  // 推荐列表为空时直接返回，避免取模 NaN 导致 keyword 被置为 undefined
  if (!noticeKeyList.value.length)
    return
  selectedIndex.value = (selectedIndex.value - 1 + noticeKeyList.value.length) % noticeKeyList.value.length || 0
  keyword.value = noticeKeyList.value[selectedIndex.value]
}

function handleKeyRecomend(e: Event) {
  const clickedInput = e.target === searchInputRef.value
  if (clickedInput)
    return

  clearNoticeKey()
}

function handleHover(i: number) {
  selectedIndex.value = i
}

function handleLeave() {
  selectedIndex.value = 0
}

function handleFocus(_e: Event) {
  handleInput(new Event('input'))
}

function setActive(_i: number) {
  selectedIndex.value = _i
}

function setInactive(_i: number) {
  selectedIndex.value = 0
}
</script>

<template>
  <div my-32 flex-center>
    <div flex bg-gray-200 h-44 class="search" dark="bg-18181a" style="position: relative;">
      <div v-show="showKeyDownSel" v-on-click-outside="handleKeyRecomend" absolute z-9 class="search-sel" style="top: 100%; width: 100%; height: 10rem;" @mouseleave="handleLeave()">
        <!-- keys recommend -->
        <div z-9 bg-fff l-0 t-100p dark="border-grey-8 bg-18181a">
          <div
            v-for="(item, i) in noticeKeyList.slice(1)" :key="i + 1" text-14 md="text-15" lg="text-15" p-5
            :class="{ 'bg-$site-hover-c': i + 1 === selectedIndex }"
            @mouseover="handleHover(i + 1)"
            @click="jumpSearch(i + 1)"
            @touchstart="setActive(i + 1)"
            @touchend="setInactive(i + 1)"
          >
            <div flex-left gap-x-8 style="margin: 0.75rem; margin-left: 2rem;">
              <div>{{ item }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-on-click-outside="() => selectionVisible = false" relative flex-center w-44 class="search-sel">
        <div class="search-img" style="width: inherit; height: inherit;" @click="toggleSelection">
          <img
            decoding="async" loading="lazy" :src="_getFavicon(searchList[currentIndex].value)" :style="iconStyle" cursor-pointer circle h-26 w-26
            style="opacity: 0.8;filter: saturate(64%);margin: auto;position: relative;top: 50%;transform: translateY(-50%);"
          >
        </div>
        <!-- Search engine selector -->
        <div
          v-show="selectionVisible" absolute z-9 border-2 bg-fff l-0 t-100p w-200
          dark="border-black-20 bg-$dark-main-bg-c"
        >
          <div
            v-for="(item, i) in searchList" :key="i" flex cursor-pointer items-center justify-between text-14 md="text-15" lg="text-15" p-5
            hover="bg-$site-hover-c" @click="changeSearch(i)"
          >
            <div flex-center gap-x-8 style="margin: 0.75rem; margin-left: 2rem;">
              <img decoding="async" loading="lazy" :src="_getFavicon(item.value)" :style="iconStyle" circle h-20 w-20>
              <div>{{ item.name }}</div>
            </div>
            <div v-if="currentIndex === i" i-carbon:checkmark text-18 />
          </div>
        </div>
      </div>
      <div flex items-center w-320>
        <input
          ref="searchInputRef" v-model="keyword" h-full w-full bg-inherit op-80 text="15 text-$text-c-1"
          dark="text-$text-dark-c-1"
          @keydown.enter="search"
          @keydown.exact="handleKeyDown"
          @input.exact="handleInput"
          @focus="handleFocus"
          @keydown.down.exact="keyNext"
          @keydown.up.exact="keyPrev"
          @keydown.ctrl.n.exact="keyNext"
          @keydown.ctrl.p.exact="keyPrev"
        >
      </div>
      <div v-if="keyword?.length > 0" flex-center gap-x-4 w-44>
        <div
          hover="op-80 rotate-180 scale-110"
          i-carbon:close mx-0 cursor-pointer text-20 op-40 transition duration-300 w-44 @click="handleCloseClick"
        />
      </div>
      <div v-if="keyword?.length === 0" flex-center cursor-pointer gap-x-4 w-44 class="search-img" style="background: transparent;" @click="search">
        <span md="text-15" lg="text-15" i-carbon:search inline-block text-14 h-20 w-44 style="background-color: var(--primary-c); opacity: 0.8; filter: saturate(84%); margin: auto;" />
      </div>
    </div>
  </div>
</template>
