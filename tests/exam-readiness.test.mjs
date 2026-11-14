import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { articleMarkdown } from '../src/articleCopy.ts'
import { findSearchIntent, intentResults } from '../src/searchIntent.ts'
import { comparableTrials } from '../src/tools.ts'
import { mergeById } from '../src/personalData.ts'

const concepts = JSON.parse(readFileSync('src/concepts/concepts.json', 'utf8'))
const aliases = JSON.parse(readFileSync('src/concepts/term_aliases_for_linking.json', 'utf8'))

test('24 supplied concepts exist, old walkthrough duplicates are removed, and three aliases point to precise terms', () => {
  const byId = new Map(concepts.map(item => [item.id, item]))
  for (const id of ['cpu','ram','c-language','powershell','assembly-language','inline-assembly','asm-volatile','pointer','memory-address','c-array','signed-integer','unsigned-integer','linker','preprocessor','printf','git','git-clone','git-commit','git-push','git-branch','gitlab-pipeline','call-stack','heap-memory','race-condition']) assert.ok(byId.has(id), id)
  assert.equal(concepts.length, 283)
  assert.equal(concepts.filter(item => item.walkthrough.trim() && item.walkthrough.trim() === item.example.trim()).length, 0)
  for (const [term, id] of [['race condition','race-condition'],['printf','printf'],['無號整數','unsigned-integer']]) assert.equal(aliases.find(item => item.text.toLowerCase() === term)?.conceptId, id)
  assert.deepEqual(concepts.filter(item => item.aliases.includes('ISR')).map(item => item.id).sort(), ['interrupt-service-routine','isr'])
})

test('symptom intent promotes real teaching articles while precise terms stay outside symptom rules', () => {
  const index = readdirSync('src/content').filter(name => name.endsWith('.md')).map(name => {
    const body = readFileSync(`src/content/${name}`, 'utf8')
    return { id: body.match(/^id:\s*(.+)$/m)?.[1]?.trim(), target: 'knowledge', title: name, summary: '', type: '技術文章' }
  })
  assert.equal(findSearchIntent('ISR'), undefined)
  assert.equal(findSearchIntent('PIO'), undefined)
  assert.equal(findSearchIntent('DMA'), undefined)
  assert.equal(intentResults('No channel', index)[0].id, 'opt-transfer-no-channel-fallback')
  for (const phrase of ['CPU 使用率高','CPU 使用效率']) assert.ok(intentResults(phrase, index).length > 0)
})

test('whole article copy preserves Markdown without duplicating an existing title', () => {
  const body = '# ROS 2 測試\n\n```c\nint x;\n```\n\n[官方文件](https://example.com)'
  assert.equal(articleMarkdown({ title: 'ROS 2 測試', body }), `${body}\n`)
  assert.match(articleMarkdown({ title: '其他標題', body }), /^# 其他標題\n\n# ROS 2 測試/)
  for (const file of ['ncku-ros2-cli-workflow.md', 'ncku-pthread-critical-section.md', 'ncku-pio-dataflow.md']) {
    const raw = readFileSync(`src/content/${file}`, 'utf8')
    const title = raw.match(/^title:\s*(.+)$/m)?.[1]?.trim()
    const sourceBody = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    const copied = articleMarkdown({ title, body: sourceBody })
    assert.ok(copied.includes(sourceBody.trim()), file)
    assert.ok(copied.includes('```'), file)
    assert.equal((copied.match(new RegExp(`^# ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'gm')) || []).length, 1, file)
  }
})

test('benchmark refuses unconfirmed, mismatched, or failed comparisons', () => {
  const baseline = { version:'A', times:[100], unit:'ms', changes:'', correctness:'已通過', notes:'', workPerRun:10, workUnit:'筆' }
  const candidate = { ...baseline, version:'B', times:[80], correctness:'通過' }
  assert.equal(comparableTrials(baseline, candidate, true), true)
  assert.equal(comparableTrials(baseline, candidate, false), false)
  assert.equal(comparableTrials(baseline, { ...candidate, workPerRun:20 }, true), false)
  assert.equal(comparableTrials(baseline, { ...candidate, workUnit:'字元' }, true), false)
  assert.equal(comparableTrials(baseline, { ...candidate, correctness:'失敗' }, true), false)
  assert.equal(comparableTrials(undefined, candidate, true), false)
})

test('note merge keeps existing order and imported duplicate ID wins', () => {
  const current = [{ id: 'one', text: 'original' }, { id: 'two', text: 'keep' }]
  const incoming = [{ id: 'one', text: 'new' }, { id: 'three', text: 'added' }]
  assert.deepEqual(mergeById(current, incoming), [{ id: 'one', text: 'new' }, { id: 'two', text: 'keep' }, { id: 'three', text: 'added' }])
  assert.equal(current[0].text, 'original')
})
