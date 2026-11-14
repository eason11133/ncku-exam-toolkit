export type SearchTarget = { id: string; target: string; title: string; summary: string; type: string }

const intents = [
  { terms: ['no channel', 'channel 用完', '通道用完'], articleIds: ['opt-transfer-no-channel-fallback', 'ncku-v2-transfer-channel-scheduling'], conceptIds: ['transfer-channel', 'transfer-claim', 'transfer-release'], termsForNext: 'Claim 失敗、資源回收' },
  { terms: ['cpu 使用率高', 'cpu 使用效率', 'cpu 很高'], articleIds: ['ops-perf-cpu-memory', 'ops-linux-processes', 'lesson-spinlock-critical-section-use-mutex', 'ncku-v2-transfer-interrupt-or-poll'], conceptIds: ['cpu', 'spinlock', 'mutex-vs-spin', 'cpu-bound'], termsForNext: '先量測 CPU、Busy Waiting、Spinlock 與重複計算' },
  { terms: ['程式卡住', '卡住'], articleIds: ['ncku-pthread-critical-section'], conceptIds: ['deadlock', 'spinlock'], termsForNext: '排查等待、鎖與阻塞' },
  { terms: ['收不到資料', '訊息沒收到'], articleIds: ['ncku-ros2-cli-workflow'], conceptIds: ['ros2-publisher', 'ros2-subscriber', 'qos'], termsForNext: '檢查 Publisher、型別與 QoS' },
] as const

export function findSearchIntent(query: string) {
  const normalized = query.trim().toLocaleLowerCase()
  return intents.find(intent => intent.terms.some(term => normalized.includes(term)))
}

export function intentResults<T extends SearchTarget>(query: string, index: T[]): T[] {
  const intent = findSearchIntent(query)
  if (!intent) return []
  return intent.articleIds.map(id => index.find(item => item.id === id && item.target === 'knowledge')).filter((item): item is T => Boolean(item))
}
