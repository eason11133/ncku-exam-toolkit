import Fuse from 'fuse.js'

export type OptimizationSource = { title: string; url: string }
export type OptimizationOption = {
  id: string
  title: string
  aliases: string[]
  summary: string
  principle: string
  conditions: string[]
  tradeoffs: string[]
  behavior: string
  metrics: string[]
  code?: { language: string; snippet: string }
  sources: OptimizationSource[]
  verified: boolean
}
export type OptimizationMethod = {
  id: string
  name: string
  aliases: string[]
  category: string
  summary: string
  problems: string[]
  bottlenecks: string[]
  verified: boolean
  updatedAt: string
  sources: OptimizationSource[]
  relatedMethodIds: string[]
  articleIds: string[]
  commandIds: string[]
  docIds: string[]
  options: OptimizationOption[]
}

export function searchOptimizationMethods(methods: OptimizationMethod[], query: string) {
  const q = query.trim()
  if (!q) return methods
  const fuse = new Fuse(methods, { threshold: 0.38, ignoreLocation: true, keys: [
    { name: 'name', weight: 5 }, { name: 'aliases', weight: 4 },
    { name: 'problems', weight: 4 }, { name: 'bottlenecks', weight: 3 },
    { name: 'options.title', weight: 4 }, { name: 'options.aliases', weight: 3 },
    { name: 'options.summary', weight: 2 }, { name: 'summary', weight: 2 },
    'category', 'options.metrics', 'options.conditions',
  ] })
  return fuse.search(q).map(result => result.item)
}

export function rankOptions(method: OptimizationMethod, query: string) {
  const q = query.trim()
  if (!q) return method.options
  const fuse = new Fuse(method.options, { threshold: 0.38, ignoreLocation: true, keys: [
    { name: 'title', weight: 5 }, { name: 'aliases', weight: 4 },
    { name: 'summary', weight: 3 }, 'conditions', 'metrics', 'tradeoffs',
  ] })
  const matched = fuse.search(q).map(result => result.item)
  return [...matched, ...method.options.filter(option => !matched.includes(option))]
}

export function technicalBackground(method: OptimizationMethod, option: OptimizationOption) {
  return [
    `目前方法：${method.name}。${method.summary}`,
    `可能瓶頸：${method.bottlenecks.join('；')}`,
    `候選方向：${option.title}。${option.summary}`,
    `原理：${option.principle}`,
    `適用條件：${option.conditions.join('；')}`,
    `限制與代價：${option.tradeoffs.join('；')}`,
    `行為與正確性：${option.behavior}`,
    `觀察指標：${option.metrics.join('、')}`,
    `參考資料：${option.sources.map(source => `${source.title} ${source.url}`).join('；')}`,
    `資料狀態：${option.verified ? '已查證' : '示範內容，尚未完整查證；必須對照實際程式與來源'}`,
  ].join('\n')
}

export function llmSuggestion(method: OptimizationMethod, option: OptimizationOption) {
  return [
    technicalBackground(method, option),
    '',
    '請檢查我目前的程式是否符合上述適用條件，並先確認真正瓶頸。若適用，請直接修改程式嘗試此方案；若不適用，指出具體原因並提出較合適的做法。',
    '請保持原有輸入輸出與必要的並行語意；若方案會改變行為，先明確指出差異。完成後執行正確性測試，對照修改前後的目標指標。不要假設此方案一定比較快。',
    option.code ? `參考範例（需依現有程式調整）：\n\n${option.code.snippet}` : '',
  ].filter(Boolean).join('\n')
}
