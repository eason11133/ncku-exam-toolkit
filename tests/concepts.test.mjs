import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createServer } from 'vite'

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

test('ISR search stays ambiguous while the Markdown renderer links only explicit meanings', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { searchConcepts, linkConcepts } = await server.ssrLoadModule('/src/concepts.ts')
    const { default: ToolkitMarkdown } = await server.ssrLoadModule('/src/ToolkitMarkdown.tsx')
    assert.deepEqual(new Set(searchConcepts('ISR').slice(0, 2).map(item => item.id)), new Set(['isr', 'interrupt-service-routine']))
    assert.ok(!linkConcepts('ISR').some(span => span.conceptId), 'bare ISR must stay unlinked')
    const html = renderToStaticMarkup(React.createElement(ToolkitMarkdown, {
      body: 'PIO ISR 儲存位元；Interrupt Service Routine 處理中斷。ISR 單獨出現時語意未定。',
      onConcept: () => {},
    }))
    assert.match(html, /concept-link[^>]*>PIO ISR<\/button>/)
    assert.match(html, /concept-link[^>]*>Interrupt Service Routine<\/button>/)
    assert.ok(!html.includes('>ISR</button>'))
  } finally {
    await server.close()
  }
})


test('all known exact terms resolve consistently, including extra linking aliases', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { searchConcepts, getExactConcepts, conceptDisplayTitle, exactConceptDisplayTitle } = await server.ssrLoadModule('/src/concepts.ts')
    const exactIds = query => getExactConcepts(query).map(item => item.id)
    for (const concept of concepts) {
      for (const term of [concept.title, concept.english, ...concept.aliases]) {
        assert.ok(exactIds(term).includes(concept.id), `concept term: ${term} -> ${concept.id}`)
      }
    }
    for (const alias of aliases) {
      assert.ok(exactIds(alias.text).includes(alias.conceptId), `linking alias: ${alias.text}`)
    }
    for (const query of ['PIO', 'DMA', 'GPIO', 'FIFO', 'OSR', 'DREQ', 'pthread', 'condition var', 'PIO ISR']) {
      const matches = getExactConcepts(query)
      assert.ok(matches.length > 0, query)
      assert.deepEqual(searchConcepts(query, matches.length).map(item => item.id), matches.map(item => item.id), query)
    }
    assert.deepEqual(new Set(exactIds('ISR')), new Set(['isr', 'interrupt-service-routine']))
    assert.match(conceptDisplayTitle(concepts.find(item => item.id === 'pio')), /PIO/)
    assert.match(exactConceptDisplayTitle(concepts.find(item => item.id === 'condition-variable'), 'condition var'), /condition var/i)
    assert.deepEqual(exactIds('pIo'), exactIds('PIO'))
  } finally {
    await server.close()
  }
})

test('concept library displays precise definitions instead of hiding ambiguous acronyms', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { searchConcepts } = await server.ssrLoadModule('/src/concepts.ts')
    const { default: ConceptLibrary } = await server.ssrLoadModule('/src/ConceptLibrary.tsx')
    const makeView = query => renderToStaticMarkup(React.createElement(ConceptLibrary, {
      concepts: searchConcepts(query, 259), query,
      onQuery: () => {}, onSelect: () => {}, onBack: () => {},
      backLabel: '返回', onNavigate: () => {},
    }))
    const pioHtml = makeView('PIO')
    assert.match(pioHtml, /PIO（可程式化輸入輸出）/)
    assert.match(pioHtml, /最符合的名詞解釋/)
    const isrHtml = makeView('ISR')
    assert.match(isrHtml, /這個名稱有不同意思/)
    assert.match(isrHtml, /輸入移位暫存器/)
    assert.match(isrHtml, /中斷服務函式/)
    const aliasHtml = makeView('condition var')
    assert.match(aliasHtml, /條件變數/)
    assert.match(aliasHtml, /最符合的名詞解釋/)
  } finally {
    await server.close()
  }
})
