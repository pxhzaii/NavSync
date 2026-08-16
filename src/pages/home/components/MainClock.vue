<script setup lang="ts">
import dayjs from 'dayjs'
import solarLunar from 'solarlunar-es'

const time = ref('')

let timeInterval: ReturnType<typeof setInterval> | undefined

function refreshTime() {
  const now = dayjs().format('YYYY年MM月DD日 HH:mm')
  const timeArr = now.split(' ')
  time.value = timeArr[1]
  if (time.value === '00:00')
    getDate()
}

function getDate() {
  const now = dayjs().format('YYYY-MM-DD')
  const dateArr = now.split('-').map(val => Number(val))
  const lunar = solarLunar.solar2lunar(dateArr[0], dateArr[1], dateArr[2])
  if (typeof lunar !== 'number') {
    // 农历信息已计算但不展示，保留以备后续使用
    const _lunar = lunar
    return _lunar
  }
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
