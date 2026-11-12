import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { searchOptimizationMethods, rankOptions, technicalBackground, llmSuggestion } from '../src/optimization-core.ts'
import { optimizationMethodSchema } from '../src/optimization-schema.ts'

const read = name => JSON.parse(readFileSync(new URL(`../src/optimizations/${name}.json`, import.meta.url), 'utf8'))
const methods = readdirSync(new URL('../src/optimizations/', import.meta.url))
  .filter(name => name.endsWith('.json'))
  .map(name => read(name.slice(0, -5)))
const articleIds = new Set(readdirSync(new URL('../src/content/', import.meta.url))
  .filter(name => name.endsWith('.md'))
  .map(name => {
    const markdown = readFileSync(new URL(`../src/content/${name}`, import.meta.url), 'utf8')
    const id = markdown.match(/^id:\s*(.+)$/m)?.[1]?.trim()
    assert.ok(id, `${name} needs a front matter id`)
    return id
  }))

test('all published methods satisfy the extensible schema', () => {
  for (const method of methods) assert.equal(optimizationMethodSchema.safeParse(method).success, true, method.id)
  assert.ok(methods.length > 0)
  assert.ok(methods.every(method => method.options.length > 0))
  assert.ok(methods.every(method => !method.verified && method.options.every(option => !option.verified)))
})

test('all linked teaching articles resolve to Markdown content', () => {
  for (const method of methods) {
    for (const id of method.articleIds) assert.ok(articleIds.has(id), `${method.id} -> ${id}`)
    for (const option of method.options) {
      if (option.articleId) assert.ok(articleIds.has(option.articleId), `${method.id}/${option.id} -> ${option.articleId}`)
    }
  }
})

test('first-version lesson manifest matches the linked options', () => {
  const links = JSON.parse(readFileSync(new URL('../FIRST_VERSION_ARTICLE_LINKS.json', import.meta.url), 'utf8'))
  for (const { methodId, optionId, articleId } of links) {
    const method = methods.find(item => item.id === methodId)
    const option = method?.options.find(item => item.id === optionId)
    assert.equal(option?.articleId, articleId, `${methodId}/${optionId}`)
  }
})

test('search finds methods by name, symptoms, and option aliases', () => {
  assert.ok(searchOptimizationMethods(methods, 'SingleThreadedExecutor').some(method => method.id === 'single-threaded-executor'))
  assert.ok(searchOptimizationMethods(methods, '鎖競爭').some(method => method.id === 'spinlock-critical-section'))
  assert.ok(searchOptimizationMethods(methods, 'Mutex').some(method => method.id === 'spinlock-critical-section'))
  assert.ok(searchOptimizationMethods(methods, 'memcpy').some(method => method.id === 'memory-buffer-copy'))
  assert.ok(searchOptimizationMethods(methods, 'PIO').some(method => method.id === 'rp2350-pio-fifo'))
})

test('matching option comes first while all alternatives remain visible', () => {
  const method = read('spinlock-critical-section')
  const ranked = rankOptions(method, 'Mutex')
  assert.equal(ranked[0].id, 'use-mutex')
  assert.equal(ranked.length, method.options.length)
})

test('copy text carries conditions, tradeoffs, behavior and direct implementation request', () => {
  const method = read('spinlock-critical-section')
  const option = method.options.find(item => item.id === 'use-mutex')
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
    ['tail latency', 'perf-tail-latency'],
    ['DMA cache', 'dma-cache-coherency'],
  ]
  for (const [query, id] of expected) {
    assert.ok(searchOptimizationMethods(methods, query).some(item => item.id === id), `${query} should find ${id}`)
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
