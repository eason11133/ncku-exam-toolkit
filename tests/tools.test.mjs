import test from 'node:test'
import assert from 'node:assert/strict'
import { stats, compare, parseTimes, toMilliseconds, buildPrompt } from '../src/tools.ts'

test('benchmark statistics and unit normalization', () => {
  assert.deepEqual(stats([120, 80, 40]), { average: 80, median: 80, min: 40, max: 120, stddev: Math.sqrt(3200 / 3), count: 3 })
  assert.equal(toMilliseconds(0.08, 's'), 80)
  assert.equal(toMilliseconds(80000, 'us'), 80)
  assert.equal(stats([]), null)
})

test('speedup and zero timing guards', () => {
  const result = compare(120, 80)
  assert.equal(result.speedup, 1.5)
  assert.ok(Math.abs(result.improvement - 33.33333333333333) < 0.000001)
  assert.equal(result.throughput, 12.5)
  assert.equal(compare(0, 80), null)
  assert.equal(compare(80, 0), null)
})

test('input validation and prompt generation', () => {
  assert.deepEqual(parseTimes('120, 80 40'), [120, 80, 40])
  assert.equal(parseTimes('120, nope'), null)
  assert.deepEqual(parseTimes(''), [])
  const prompt = buildPrompt({ task: 'Debug Error', language: 'C', domain: '', goal: 'Find a crash.', constraints: '', extra: '' })
  assert.match(prompt, /Task: Debug Error/)
  assert.match(prompt, /Programming language: C/)
  assert.match(prompt, /Goal: Find a crash/)
})
