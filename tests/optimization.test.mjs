import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { searchOptimizationMethods, rankOptions, technicalBackground, llmSuggestion } from '../src/optimization-core.ts'
import { optimizationMethodSchema } from '../src/optimization-schema.ts'

const read = name => JSON.parse(readFileSync(new URL(`../src/optimizations/${name}.json`, import.meta.url), 'utf8'))
const methods = [read('mutex'), read('bfs'), read('memory-copy')]
const importedMethods = readdirSync(new URL('../src/optimizations/', import.meta.url))
  .filter(name => name.endsWith('.json'))
  .map(name => read(name.slice(0, -5)))

test('all demonstration files satisfy the extensible schema', () => {
  for (const method of methods) assert.equal(optimizationMethodSchema.safeParse(method).success, true, method.id)
})

test('search finds methods by name, symptoms, and option aliases', () => {
  assert.equal(searchOptimizationMethods(methods, 'Mutex')[0]?.id, 'mutex')
  assert.equal(searchOptimizationMethods(methods, '鎖競爭')[0]?.id, 'mutex')
  assert.equal(searchOptimizationMethods(methods, 'atomic')[0]?.id, 'mutex')
  assert.equal(searchOptimizationMethods(methods, '記憶體複製太慢')[0]?.id, 'memory-copy')
  assert.equal(searchOptimizationMethods(methods, 'BFS')[0]?.id, 'bfs')
})

test('matching option comes first while all alternatives remain visible', () => {
  const ranked = rankOptions(methods[0], 'Spinlock')
  assert.equal(ranked[0].id, 'spinlock')
  assert.equal(ranked.length, 5)
})

test('copy text carries conditions, tradeoffs, behavior and direct implementation request', () => {
  const method = methods[0]
  const option = method.options.find(item => item.id === 'atomic-operations')
  const background = technicalBackground(method, option)
  const suggestion = llmSuggestion(method, option)
  assert.match(background, /適用條件：/)
  assert.match(background, /限制與代價：/)
  assert.match(background, /行為與正確性：/)
  assert.match(background, /https:\/\//)
  assert.match(suggestion, /請直接修改程式/)
  assert.match(suggestion, /不要假設此方案一定比較快/)
})

test('imported methods remain searchable by exam terms and symptoms', () => {
  const expected = [
    ['SingleThreadedExecutor', 'single-threaded-executor'],
    ['訊息處理延遲', 'single-threaded-executor'],
    ['PIO', 'rp2350-pio-fifo'],
    ['FIFO', 'rp2350-pio-fifo'],
    ['pthread', 'pthread-work-partition'],
    ['Transfer Engine', 'transfer-engine-configuration'],
    ['位元運算', 'c-bitfield-operations'],
  ]
  for (const [query, id] of expected) {
    assert.ok(searchOptimizationMethods(importedMethods, query).some(item => item.id === id), `${query} should find ${id}`)
  }
})

test('three SingleThreadedExecutor options open their corresponding articles', () => {
  const method = read('single-threaded-executor')
  assert.equal(optimizationMethodSchema.safeParse(method).success, true)
  assert.deepEqual(method.options.map(option => option.articleId), [
    'ros2-ste-short-callback',
    'ros2-ste-multithreaded-groups',
    'ros2-ste-process-pool',
  ])
})
