<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Category } from '@/types'

const modalStore = useModalStore()
const siteStore = useSiteStore()
const route = useRoute()

function handleCateClick(cateIndex: number) {
  if (route.name === 'setting' && siteStore.cateIndex === cateIndex)
    modalStore.showModal('update', 'cate')
  else
    siteStore.setCateIndex(cateIndex)
}

const settingStore = useSettingStore()

const { draggableOptions, handleStart, handleEnd } = useDrag()

function handleDragEnd(e: any) {
  handleEnd()
  const { oldIndex, newIndex } = e
  const { cateIndex } = siteStore
  if (oldIndex === cateIndex && newIndex !== cateIndex) {
    siteStore.setCateIndex(newIndex)
  }
  else {
    if ((oldIndex < cateIndex && newIndex < cateIndex)
          || (oldIndex > cateIndex && newIndex > cateIndex))
      return

    if (oldIndex < cateIndex)
      siteStore.setCateIndex(cateIndex - 1)
    else if (oldIndex > cateIndex)
      siteStore.setCateIndex(cateIndex + 1)
  }
}
</script>

<template>
  <section
    :class="{
      nav__items: !settingStore.isSetting,
    }"
    flex-center pb-16 text-14 md="text-15 pb-32" lg="text-15 pb-32"
  >
    <draggable
      class="flex gap-x-12"
      :list="siteStore.data"
      item-key="id"
      :component-data="{
        tag: 'div',
        type: 'transition-group',
      }"
      v-bind="draggableOptions"
      style="overflow: scroll; white-space: nowrap;"
      @start="handleStart"
      @end="handleDragEnd"
    >
      <template #item="{ element: cate, index: i }: { element: Category, index: number }">
        <div
          :class="{
            // white setting
            'text-$primary-light-c hover:text-$text-c': siteStore.cateIndex !== i && settingStore.isWhiteTheme,
            'border-$text-c text-$text-c': siteStore.cateIndex === i && settingStore.isWhiteTheme,
            // colorful setting
            'border-$primary-c text-$primary-c': siteStore.cateIndex === i && !settingStore.isWhiteTheme,
            'hover:text-$primary-c': !settingStore.isWhiteTheme,
            // common setting
            'site--setting': settingStore.isSetting,
            'site--select': siteStore.cateIndex === i && settingStore.isSetting,
          }"
          border="b-2 transparent"
          shrink-0 cursor-pointer transition-color duration-300 p-4
          style="text-align: center;"
          @click="handleCateClick(i)"
        >
          {{ cate.name }}
        </div>
      </template>
    </draggable>
    <n-button

      v-if="settingStore.isSetting"
      class="ml-12"
      type="primary"
      size="small"
      :focusable="false"
      secondary min-h-30
      @click="modalStore.showModal('add', 'cate')"
    >
      <template #icon>
        <div i-carbon:add />
      </template>
    </n-button>
  </section>
</template>

<style lang="scss" scoped>
.site--setting {
  border: 1px dashed var(--setting-border-c);
  border-radius: 2px;
}

.site--select {
  background-color: var(--setting-group-bg-c);
}

.nav__items {
  padding-bottom: 8rem;
}
</style>
