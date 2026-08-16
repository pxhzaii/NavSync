<script setup lang="ts">
import { RouterLink } from 'vue-router'

const route = useRoute()

function toggleSetting() {
  return route.path === '/setting'
}

function getIconClass(routeName: string) {
  return {
    'text-$primary-c opacity-100': routeName === route.name,
  }
}
</script>

<template>
  <div flex justify-between py-24 px="12 md:24 lg:48">
    <RouterLink to="/">
      <div text="$primary-c" flex-center text-16 style="font-weight: bold;">
        <img decoding="async" loading="lazy" src="/favicon.png" inline-block text-32 transition duration-300 w-32 hover="opacity-70">
      </div>
    </RouterLink>
    <div flex gap-x-8>
      <RouterLink :class="getIconClass('setting')" :to="toggleSetting() ? '/' : '/setting'" i-carbon:settings icon-btn />
    </div>
  </div>
</template>
