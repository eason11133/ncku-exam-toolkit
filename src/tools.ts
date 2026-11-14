export type Trial = { version: string; times: number[]; unit: 'ms' | 's' | 'us'; changes: string; correctness: string; notes: string; workPerRun?: number; workUnit?: string }
export const workflowSteps = ['Correctness', 'Baseline', 'Profiling', 'Hypothesis', 'Change', 'Benchmark', 'Compare', 'Keep / Revert'] as const

export function toMilliseconds(value: number, unit: Trial['unit']) { return unit === 's' ? value * 1000 : unit === 'us' ? value / 1000 : value }
export function stats(values: number[]) {
  const valid = values.filter(value => Number.isFinite(value) && value >= 0)
  if (!valid.length) return null
  const sorted = [...valid].sort((a, b) => a - b)
  const average = valid.reduce((sum, value) => sum + value, 0) / valid.length
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  const stddev = Math.sqrt(valid.reduce((sum, value) => sum + (value - average) ** 2, 0) / valid.length)
  return { average, median, min: sorted[0], max: sorted[sorted.length - 1], stddev, count: valid.length }
}
export function compare(baselineMs: number, candidateMs: number, workPerRun = 1) {
  if (!(baselineMs > 0) || !(candidateMs > 0)) return null
  return { speedup: baselineMs / candidateMs, improvement: (baselineMs - candidateMs) / baselineMs * 100, throughput: workPerRun * 1000 / candidateMs }
}
export function correctnessPassed(value: string) { return /^(通過|已通過|正確|pass|passed|ok)$/i.test(value.trim()) }
export function comparableTrials(baseline: Trial | undefined, candidate: Trial, sameConditions: boolean) {
  if (!baseline || !sameConditions || !correctnessPassed(baseline.correctness) || !correctnessPassed(candidate.correctness)) return false
  if (!(Number.isFinite(baseline.workPerRun ?? 1) && Number.isFinite(candidate.workPerRun ?? 1))) return false
  return (baseline.workPerRun ?? 1) === (candidate.workPerRun ?? 1) && (baseline.workUnit || '次執行') === (candidate.workUnit || '次執行')
}
export function parseTimes(input: string) {
  const parts = input.split(/[\s,;]+/).filter(Boolean)
  if (!parts.length) return []
  const values = parts.map(Number)
  return values.every(value => Number.isFinite(value) && value >= 0) ? values : null
}
export function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function csvCell(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"` }

export const promptTasks = [
  'Understand Project', 'Explain Architecture', 'Locate Relevant Code', 'Implement Feature', 'Debug Error',
  'Analyze Performance', 'Optimize Code', 'Review Changes', 'Explain Documentation', 'Compare Solutions',
  'Generate Tests', 'Fix Compilation Errors', 'Analyze Memory Usage', 'Analyze Concurrency', 'Analyze Hardware Interface',
] as const
export function buildPrompt(input: { task: string; language: string; domain: string; goal: string; constraints: string; extra: string }) {
  return [
    `Task: ${input.task}.`,
    input.language && `Programming language: ${input.language}.`,
    input.domain && `Technical domain: ${input.domain}.`,
    input.goal && `Goal: ${input.goal}`,
    input.constraints && `Constraints: ${input.constraints}`,
    input.extra && `Additional context: ${input.extra}`,
    'Use only the information I provide. State assumptions and uncertainty. Give concrete steps and verification criteria.',
  ].filter(Boolean).join('\n\n')
}
