import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const concepts = readJson('src/concepts/concepts.json')
const aliases = readJson('src/concepts/term_aliases_for_linking.json')
const articleFiles = readdirSync('src/content').filter(name => name.endsWith('.md'))
const articles = new Map(articleFiles.map(name => {
  const raw = readFileSync(`src/content/${name}`, 'utf8')
  return [raw.match(/^id:\s*(.+)$/m)?.[1]?.trim(), raw]
}))
const methods = new Map(readdirSync('src/optimizations').filter(name => name.endsWith('.json')).map(name => {
  const method = readJson(`src/optimizations/${name}`)
  return [method.id, method]
}))

test('every imported concept resolves to real content and aliases are unambiguous', () => {
  assert.ok(concepts.length > 0)
  const byId = new Map(concepts.map(concept => [concept.id, concept]))
  assert.equal(byId.size, concepts.length)
  for (const concept of concepts) {
    assert.ok(concept.explanation && concept.example && concept.whenToUse, concept.id)
    if (concept.relatedArticle) assert.ok(articles.has(concept.relatedArticle.articleId), concept.id)
    if (concept.exampleSolution) {
      const method = methods.get(concept.exampleSolution.methodId)
      assert.ok(method?.options.some(option => option.id === concept.exampleSolution.optionId), concept.id)
    }
    for (const related of concept.relatedConceptIds) assert.ok(byId.has(related), `${concept.id} → ${related}`)
  }
  const byAlias = new Map()
  for (const alias of aliases) {
    assert.ok(byId.has(alias.conceptId), alias.text)
    const key = alias.text.toLocaleLowerCase()
    assert.ok(!byAlias.has(key) || byAlias.get(key) === alias.conceptId, `ambiguous alias: ${alias.text}`)
    byAlias.set(key, alias.conceptId)
  }
})

test('published Markdown has no visible raw bold delimiters outside code', () => {
  for (const [id, raw] of articles) {
    const body = raw.replace(/^---[\s\S]*?---\s*/, '')
    const html = renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, body))
    const visible = html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '')
    assert.ok(!visible.includes('**'), id)
  }
})
