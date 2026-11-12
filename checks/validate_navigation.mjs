import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = name => JSON.parse(readFileSync(path.join(root, name), 'utf8'))
const files = dir => readdirSync(path.join(root, dir)).filter(name => name.endsWith('.json'))

export function readNavigationData() {
  const taxonomy = read('src/navigation/taxonomy.json')
  const concepts = read('src/concepts/concepts.json')
  const conceptRoutes = read('src/navigation/concept_routes.json')
  const articleRoutes = read('src/navigation/article_routes.json')
  const methodRoutes = read('src/navigation/optimization_routes.json')
  const articleIds = []
  for (const name of readdirSync(path.join(root, 'src/content'))) {
    if (name.endsWith('.md')) {
      const raw = readFileSync(path.join(root, 'src/content', name), 'utf8')
      const id = raw.match(/^id:\s*(\S+)\s*$/m)?.[1]
      articleIds.push(id || `MISSING_FRONTMATTER:${name}`)
      if (id !== name.slice(0, -3)) articleIds.push(`MISMATCHED_FILENAME:${name}`)
    } else if (name.endsWith('.json')) articleIds.push(read(`src/content/${name}`).id)
  }
  const methodIds = files('src/optimizations').map(name => read(`src/optimizations/${name}`).id)
  return { taxonomy, conceptIds: concepts.map(item => item.id), articleIds, methodIds, conceptRoutes, articleRoutes, methodRoutes }
}

export function validateNavigation(data) {
  const errors = []
  const nodes = []
  const visit = node => {
    nodes.push(node)
    if (!node.id || !node.label || !node.question || !node.hint || !Array.isArray(node.children)) errors.push(`分類節點欄位不完整：${node.id || '(無 ID)'}`)
    for (const child of node.children || []) visit(child)
  }
  for (const node of data.taxonomy.roots) visit(node)
  const nodeIds = nodes.map(node => node.id)
  if (new Set(nodeIds).size !== nodeIds.length) errors.push('分類節點 ID 重複')
  const leaves = new Set(nodes.filter(node => node.children?.length === 0).map(node => node.id))
  if (!leaves.size) errors.push('分類樹沒有葉節點')
  for (const [kind, actual, routes, key] of [
    ['觀念', data.conceptIds, data.conceptRoutes, 'conceptId'],
    ['文章', data.articleIds, data.articleRoutes, 'articleId'],
    ['優化方法', data.methodIds, data.methodRoutes, 'methodId'],
  ]) {
    const actualSet = new Set(actual)
    const routeIds = routes.map(route => route[key])
    const routeSet = new Set(routeIds)
    if (actualSet.size !== actual.length) errors.push(`${kind}實際 ID 重複`)
    if (routeSet.size !== routeIds.length) errors.push(`${kind}分類對照 ID 重複`)
    for (const id of actualSet) if (!routeSet.has(id)) errors.push(`${kind}漏分：${id}`)
    for (const id of routeSet) if (!actualSet.has(id)) errors.push(`${kind}指向不存在內容：${id}`)
    for (const route of routes) {
      if (!leaves.has(route.primaryLeafId)) errors.push(`${kind}主要分類無效：${route[key]} → ${route.primaryLeafId}`)
      if (!Array.isArray(route.secondaryLeafIds)) { errors.push(`${kind}相關分類不是陣列：${route[key]}`); continue }
      if (new Set(route.secondaryLeafIds).size !== route.secondaryLeafIds.length) errors.push(`${kind}相關分類重複：${route[key]}`)
      for (const id of route.secondaryLeafIds) {
        if (!leaves.has(id)) errors.push(`${kind}相關分類無效：${route[key]} → ${id}`)
        if (id === route.primaryLeafId) errors.push(`${kind}主要與相關分類相同：${route[key]}`)
      }
    }
  }
  for (const leaf of leaves) {
    if (![...data.conceptRoutes, ...data.articleRoutes, ...data.methodRoutes].some(route => route.primaryLeafId === leaf)) errors.push(`空分類：${leaf}`)
  }
  return { errors, roots: data.taxonomy.roots.length, leaves: leaves.size, concepts: data.conceptIds.length, articles: data.articleIds.length, methods: data.methodIds.length }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateNavigation(readNavigationData())
  console.log(`分類 ${result.roots} 大類／${result.leaves} 葉節點；觀念 ${result.concepts}、文章 ${result.articles}、方法 ${result.methods}`)
  for (const error of result.errors) console.error(`ERROR: ${error}`)
  if (result.errors.length) process.exitCode = 1
  else console.log('PASS：所有教材均有有效分類，無重複或失效 ID。')
}
