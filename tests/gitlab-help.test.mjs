import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const file = JSON.parse(readFileSync('src/gitlab-help/data.json', 'utf8'))
const app = readFileSync('src/App.tsx', 'utf8')
const page = readFileSync('src/GitLabHelp.tsx', 'utf8')

test('GitLab help has an independent page and discoverable navigation', () => {
  assert.match(app, /id: 'gitlab-help', label: 'GitLab 操作與排錯'/)
  assert.match(app, /view === 'gitlab-help' && <GitLabHelp\/>/)
  assert.match(app, /GitLab 操作與問題排查/)
  assert.match(page, /aria-label="搜尋 GitLab 錯誤"/)
})

test('GitLab trouble cases have unique IDs and concrete remedies', () => {
  assert.ok(file.checklists.length >= 4)
  assert.ok(file.issues.length >= 12)
  const ids = new Set()
  for (const issue of file.issues) {
    assert.ok(!ids.has(issue.id), issue.id)
    ids.add(issue.id)
    assert.ok(issue.title && issue.symptom && issue.cause, issue.id)
    assert.ok(issue.fix.length >= 2, issue.id)
    assert.ok(issue.code.trim().length > 0, issue.id)
  }
  for (const wanted of ['powershell-angle','http-unsafe','ssh-fingerprint','pipeline-pending','pipeline-failed','passed-no-score','wrong-branch']) {
    assert.ok(ids.has(wanted), wanted)
  }
})

test('Help avoids unsafe global Git settings and distinguishes practice vs exam', () => {
  const text = JSON.stringify(file)
  assert.ok(!text.includes('git config --global credential.allowUnsafeRemotes true'))
  assert.ok(!text.includes('git push --force origin'))
  assert.match(text, /今年現場規則/)
  assert.match(text, /Job Log/)
  assert.match(text, /hello.py/)
  for (const item of file.sources) assert.match(item.url, /^https:\/\//)
})
