export function getRandomDarkColor() {
  const ranges = [64, 128, 256]
  const rRange = ranges[Math.floor(Math.random() * ranges.length)]
  const gRange = ranges[Math.floor(Math.random() * ranges.length)]
  const bRange = ranges[Math.floor(Math.random() * ranges.length)]
  const r = Math.floor(Math.random() * rRange).toString(16).padStart(2, '0')
  const g = Math.floor(Math.random() * (gRange === 256 ? gRange * 0.8 : gRange)).toString(16).padStart(2, '0')
  const b = Math.floor(Math.random() * bRange).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

/** 生成 0~1 之间的随机数（用于组件 key 刷新等场景） */
export function getRandomComplexNumber(): number {
  return Math.random() || (Date.now() / 1e13)
}
