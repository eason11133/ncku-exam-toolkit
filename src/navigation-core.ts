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

export const taxonomy = taxonomyData.roots as TaxonomyNode[]
const conceptRoutes = new Map(conceptRoutesData.map(route => [route.conceptId, route]))
const articleRoutes = new Map(articleRoutesData.map(route => [route.articleId, route]))
const methodRoutes = new Map(optimizationRoutesData.map(route => [route.methodId, route]))

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
  const candidates = navigationCandidates(node)
  return candidates.concepts.length + candidates.articles.length + candidates.methods.length
}

const optionLine = (node: TaxonomyNode) => `- ${node.id}｜${node.label}：${node.question}（${node.hint}）`

export function navigationPrompt(path: TaxonomyNode[], showCandidates: boolean): string {
  const current = path.at(-1)
  if (!current) return promptData.root.template.replace('{root_options}', taxonomy.map(optionLine).join('\n'))

  const pathContext = `【目前分類路徑】\n${path.map(node => `- ${node.id}｜${node.label}：${node.question}（${node.hint}）`).join('\n')}\n\n`
  if (showCandidates || current.children.length === 0) {
    const candidates = navigationCandidates(current)
    const conceptLines = (coverage: 'demo' | 'extension') => candidates.concepts.filter(({ item }) => item.coverage === coverage)
      .map(({ item, related }) => `- ${item.id}｜${item.title}：${item.explanation}${related ? '【跨分類相關】' : ''}`)
    const articleLines = candidates.articles.map(({ item, related }) => `- ${item.id}｜${item.title}：${item.summary}${related ? '【跨分類相關】' : ''}`)
    const methodLines = candidates.methods.flatMap(({ item, related }) => [
      `- ${item.id}｜${item.name}：${item.summary}${related ? '【跨分類相關】' : ''}`,
      ...item.options.map(option => `  - ${item.id}::${option.id}｜${item.name} → ${option.title}：${option.summary}${related ? '【跨分類相關】' : ''}`),
    ])
    const availableItems = [
      '【先看觀念｜Demo 相關】', ...conceptLines('demo'),
      '【先看觀念｜延伸】', ...conceptLines('extension'),
      '【再看技術文章】', ...articleLines,
      '【再看優化方法／選項】', ...methodLines,
    ].join('\n')
    return pathContext + promptData.articles.template.replace('{available_items}', availableItems)
  }
  return pathContext + promptData.branch.template.replace('{child_options}', current.children.map(optionLine).join('\n'))
}
