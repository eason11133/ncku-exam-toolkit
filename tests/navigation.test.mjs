import assert from 'node:assert/strict'
import test from 'node:test'
import { readNavigationData, validateNavigation } from '../checks/validate_navigation.mjs'

const data = readNavigationData()

test('attachment taxonomy and all current content routes validate', () => {
  const result = validateNavigation(data)
  assert.deepEqual(result.errors, [])
  assert.equal(result.roots, 7)
  assert.equal(result.leaves, 29)
  assert.equal(result.concepts, 217)
  assert.equal(result.articles, 92)
  assert.equal(result.methods, 47)
})

test('cross-category PIO FIFO and DMA content remains discoverable from both paths', () => {
  const article = data.articleRoutes.find(route => route.articleId === 'lesson-rp2350-pio-fifo-pio-with-dma')
  const method = data.methodRoutes.find(route => route.methodId === 'rp2350-pio-fifo')
  assert.equal(article?.primaryLeafId, 'transfer-dma')
  assert.ok(article.secondaryLeafIds.includes('pio-fifo'))
  assert.equal(method?.primaryLeafId, 'pio-fifo')
  assert.ok(method.secondaryLeafIds.includes('transfer-dma'))
})

test('new article requires only content and route mapping', () => {
  const articleId = 'navigation-test-article'
  const withArticle = { ...data, articleIds: [...data.articleIds, articleId] }
  assert.ok(validateNavigation(withArticle).errors.some(error => error.includes(`文章漏分：${articleId}`)))
  const withRoute = { ...withArticle, articleRoutes: [...data.articleRoutes, { articleId, primaryLeafId: 'pio-fifo', secondaryLeafIds: ['transfer-dma'] }] }
  assert.deepEqual(validateNavigation(withRoute).errors, [])
})
