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

export function getRandomComplexNumber() {
  // Math.random() 极少返回 0 或产生科学计数法（如 1e-7），
  // 用 Date.now() 补偿确保始终得到合法的小数
  const random = Math.random() || Date.now() / 1e13
  const randomStr = random.toString().split('.')[1]
  if (!randomStr)
    return Math.random()
  const randomLength = randomStr.length
  const randomComplexNumber = Number(randomStr) / 10 ** randomLength
  return randomComplexNumber
}
