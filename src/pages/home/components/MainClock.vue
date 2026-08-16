<script setup lang="ts">
import dayjs from 'dayjs'

const time = ref('')

let timeInterval: ReturnType<typeof setInterval> | undefined

function refreshTime() {
  const now = dayjs().format('YYYY年MM月DD日 HH:mm')
  const timeArr = now.split(' ')
  time.value = timeArr[1]
}

function timing() {
  // 先清理旧定时器，防止组件重新挂载时多个 interval 并行
  if (timeInterval)
    clearInterval(timeInterval)
  refreshTime()
  const nowMinute = time.value
  timeInterval = setInterval(() => {
    refreshTime()
    if (nowMinute !== time.value) {
      clearInterval(timeInterval)
      timeInterval = setInterval(refreshTime, 60000)
    }
  }, 1000)
}

onMounted(() => {
  timing()
})

onBeforeUnmount(() => {
  if (timeInterval)
    clearInterval(timeInterval)
})
</script>

<template>
  <div text-center>
    <div text-48>
      {{ time }}
    </div>
  </div>
</template>
