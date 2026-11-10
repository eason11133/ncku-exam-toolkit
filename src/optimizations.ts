import type { OptimizationMethod } from './optimization-core'
import { optimizationMethodSchema } from './optimization-schema'

const files = import.meta.glob('./optimizations/*.json', { eager: true, import: 'default' })
export const optimizations: OptimizationMethod[] = Object.entries(files).map(([path, value]) => {
  const parsed = optimizationMethodSchema.safeParse(value)
  if (!parsed.success) throw new Error(`解法資料格式錯誤 ${path}: ${parsed.error.message}`)
  return parsed.data
})

const ids = new Set<string>()
for (const item of optimizations) {
  if (ids.has(item.id)) throw new Error(`重複的解法方法 ID：${item.id}`)
  ids.add(item.id)
  const optionIds = new Set<string>()
  for (const entry of item.options) {
    if (optionIds.has(entry.id)) throw new Error(`重複的方案 ID：${item.id}/${entry.id}`)
    optionIds.add(entry.id)
  }
}
