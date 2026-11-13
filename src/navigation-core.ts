import taxonomyData from './navigation/taxonomy.json'
import conceptRoutesData from './navigation/concept_routes.json'
import articleRoutesData from './navigation/article_routes.json'
import optimizationRoutesData from './navigation/optimization_routes.json'
import promptData from './navigation/prompt_templates.json'
import { articles, type Article } from './content'
import { concepts, type Concept } from './concepts'
import { optimizations } from './optimizations'
import type { OptimizationMethod } from './optimization-core'

export type TaxonomyNode = { id: string; label: string; question: string; hint: string; children: TaxonomyNode[] }
type Route = { primaryLeafId: string; secondaryLeafIds: string[] }
export type Routed<T> = { item: T; related: boolean }
export type NavigationCandidates = {
  concepts: Routed<Concept>[]
  articles: Routed<Article>[]
  methods: Routed<OptimizationMethod>[]
}
export type ReadingArticle = Routed<Article> & { solutionLesson: boolean }

export const taxonomy = taxonomyData.roots as TaxonomyNode[]
const conceptRoutes = new Map(conceptRoutesData.map(route => [route.conceptId, route]))
const articleRoutes = new Map(articleRoutesData.map(route => [route.articleId, route]))
const methodRoutes = new Map(optimizationRoutesData.map(route => [route.methodId, route]))
const articleById = new Map(articles.map(article => [article.id, article]))
const solutionArticleIds = new Set(optimizations.flatMap(method => method.options.map(option => option.articleId).filter((id): id is string => Boolean(id))))

export function findNavigationNode(path: string[]): TaxonomyNode | undefined {
  let nodes = taxonomy
  let current: TaxonomyNode | undefined
  for (const id of path) {
    current = nodes.find(node => node.id === id)
    if (!current) return undefined
    nodes = current.children
  }
  return current
}

export function leafIds(node: TaxonomyNode): Set<string> {
  if (!node.children.length) return new Set([node.id])
  return new Set(node.children.flatMap(child => [...leafIds(child)]))
}

function relation(route: Route | undefined, leaves: Set<string>): 'primary' | 'secondary' | null {
  if (!route) return null
  if (leaves.has(route.primaryLeafId)) return 'primary'
  return route.secondaryLeafIds.some(id => leaves.has(id)) ? 'secondary' : null
}

export function navigationCandidates(node: TaxonomyNode): NavigationCandidates {
  const leaves = leafIds(node)
  const collect = <T extends { id: string }>(items: T[], routes: Map<string, Route>): Routed<T>[] => items.flatMap(item => {
    const match = relation(routes.get(item.id), leaves)
    return match ? [{ item, related: match === 'secondary' }] : []
  })
  return {
    concepts: collect(concepts, conceptRoutes).sort((a, b) => Number(a.item.coverage !== 'demo') - Number(b.item.coverage !== 'demo') || a.item.title.localeCompare(b.item.title, 'zh-Hant')),
    articles: collect(articles, articleRoutes).sort((a, b) => a.item.title.localeCompare(b.item.title, 'zh-Hant')),
    methods: collect(optimizations, methodRoutes).sort((a, b) => a.item.name.localeCompare(b.item.name, 'zh-Hant')),
  }
}

export function navigationCount(node: TaxonomyNode) {
  return navigationReading(node).length
}

export function navigationReading(node: TaxonomyNode): ReadingArticle[] {
  const candidates = navigationCandidates(node)
  const leaves = leafIds(node)
  const found = new Map<string, ReadingArticle>()
  for (const { item, related } of candidates.articles) found.set(item.id, { item, related, solutionLesson: solutionArticleIds.has(item.id) })
  for (const { item: method } of candidates.methods) {
    for (const option of method.options) {
      if (!option.articleId || found.has(option.articleId)) continue
      const article = articleById.get(option.articleId)
      if (article) found.set(article.id, { item: article, related: relation(articleRoutes.get(article.id), leaves) !== 'primary', solutionLesson: true })
    }
  }
  return [...found.values()].sort((a, b) => Number(a.related) - Number(b.related) || a.item.title.localeCompare(b.item.title, 'zh-Hant'))
}

export function relatedNavigationNodes(path: TaxonomyNode[]): TaxonomyNode[] {
  const current = path.at(-1)
  if (!current) return []
  const siblings = path.at(-2)?.children || taxonomy
  return siblings.filter(node => node.id !== current.id && navigationCount(node) > 0)
}

const optionLine = (node: TaxonomyNode) => `- ${node.id}｜${node.label}：${node.question}（${node.hint}）`

export function navigationPrompt(path: TaxonomyNode[], showCandidates: boolean): string {
  const current = path.at(-1)
  if (!current) return promptData.root.template.replace('{root_options}', taxonomy.map(optionLine).join('\n'))

  const pathContext = `【目前分類路徑】\n${path.map(node => `- ${node.id}｜${node.label}：${node.question}（${node.hint}）`).join('\n')}\n\n`
  if (showCandidates || current.children.length === 0) {
    const reading = navigationReading(current)
    if (!reading.length) {
      const relatedOptions = relatedNavigationNodes(path).map(optionLine).join('\n') || '沒有相鄰分類可選；請返回上一層或改用搜尋。'
      return pathContext + promptData.emptyArticles.template.replace('{related_options}', relatedOptions)
    }
    const direct = reading.filter(entry => !entry.related)
    const related = reading.filter(entry => entry.related)
    const line = ({ item, solutionLesson }: ReadingArticle) => `- ${item.id}｜${item.title}：${item.summary}${solutionLesson ? '【解法教材】' : '【技術文章】'}`
    const availableItems = [
      direct.length ? '【此分類的教材文章】' : '【此分類沒有直接對應文章】',
      ...direct.map(line),
      ...(related.length ? ['【跨分類相關教材】', ...related.map(line)] : []),
    ].join('\n')
    return pathContext + promptData.articles.template.replace('{available_items}', availableItems)
  }
  return pathContext + promptData.branch.template.replace('{child_options}', current.children.map(optionLine).join('\n'))
}
