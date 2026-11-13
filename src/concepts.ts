import Fuse from 'fuse.js'
import rawConcepts from './concepts/concepts.json'
import rawAliases from './concepts/term_aliases_for_linking.json'
import aliasPolicy from './concepts/alias_policy.json'
import newAliasContext from './concepts/new_alias_context.json'

export type Concept = (typeof rawConcepts)[number]
export const concepts: Concept[] = rawConcepts
export const conceptById = new Map(concepts.map(concept => [concept.id, concept]))

const aliases = rawAliases.filter(alias => conceptById.has(alias.conceptId))
  .sort((a, b) => b.text.length - a.text.length)
// These words remain searchable, but ordinary prose does not establish their technical meaning.
const contextRequired = new Set([...aliasPolicy.prohibitedAutoLinksInOrdinaryProse, ...newAliasContext.filter(item => item.linkPolicy === 'explicit-technical-context').map(item => item.text)].map(text => text.toLocaleLowerCase()))
const aliasesByFirst = new Map<string, typeof aliases>()
for (const alias of aliases) {
  const first = alias.text[0].toLocaleLowerCase()
  aliasesByFirst.set(first, [...(aliasesByFirst.get(first) || []), alias])
}
const fuse = new Fuse(concepts, {
  includeScore: true, threshold: 0.38, ignoreLocation: true,
  keys: [{ name: 'title', weight: 5 }, { name: 'english', weight: 4 }, { name: 'aliases', weight: 4 }, { name: 'explanation', weight: 1 }, 'category'],
})
const normalize = (value: string) => value.trim().toLocaleLowerCase()

// Use one exact-match index for both the global search and the concept library.
// Search aliases from markdown linking must work here too.
const exactIdsByTerm = new Map<string, Set<string>>()
function addExactTerm(term: string, conceptId: string): void {
  const key = normalize(term)
  if (!key || !conceptById.has(conceptId)) return
  const matches = exactIdsByTerm.get(key) || new Set<string>()
  matches.add(conceptId)
  exactIdsByTerm.set(key, matches)
}
for (const concept of concepts) {
  for (const term of [concept.title, concept.english, ...concept.aliases]) addExactTerm(term, concept.id)
}
for (const alias of aliases) addExactTerm(alias.text, alias.conceptId)

export function getExactConcepts(query: string): Concept[] {
  const ids = exactIdsByTerm.get(normalize(query))
  return ids ? [...ids].map(id => conceptById.get(id)!).filter(Boolean) : []
}

export function conceptDisplayTitle(concept: Concept): string {
  const abbreviation = concept.aliases.find(alias => /^[A-Z][A-Z0-9_-]{1,11}$/.test(alias))
  if (!abbreviation) return concept.title
  const compact = (value: string) => value.toLocaleUpperCase().replace(/[^A-Z0-9]/g, '')
  return compact(concept.title).includes(compact(abbreviation)) ? concept.title : `${abbreviation}（${concept.title}）`
}

export function exactConceptDisplayTitle(concept: Concept, query: string): string {
  const display = conceptDisplayTitle(concept)
  const key = normalize(query)
  if (!key || normalize(display).includes(key)) return display
  const supplied = [concept.english, ...concept.aliases, ...aliases.filter(alias => alias.conceptId === concept.id).map(alias => alias.text)]
    .find(value => normalize(value) === key) || query.trim()
  return /^[\x20-\x7E]{2,48}$/.test(supplied) ? `${supplied}（${concept.title}）` : display
}

export function searchConcepts(query: string, limit = 12): Concept[] {
  const needle = normalize(query)
  if (!needle) return concepts.slice(0, limit)
  const exact = getExactConcepts(query)
  const seen = new Set(exact.map(concept => concept.id))
  return [...exact, ...fuse.search(query).map(result => result.item).filter(concept => !seen.has(concept.id))].slice(0, limit)
}

const word = /[\p{L}\p{N}_]/u
const latin = /[A-Za-z0-9_]/
export type ConceptSpan = { text: string; conceptId?: string }

export function linkConcepts(text: string, used = new Set<string>()): ConceptSpan[] {
  const spans: ConceptSpan[] = []
  let cursor = 0
  while (cursor < text.length) {
    const match = (aliasesByFirst.get(text[cursor].toLocaleLowerCase()) || []).find(alias => {
      if (contextRequired.has(alias.text.toLocaleLowerCase())) return false
      if (used.has(alias.conceptId)) return false
      if (text.slice(cursor, cursor + alias.text.length).toLocaleLowerCase() !== normalize(alias.text)) return false
      const first = alias.text[0]
      const last = alias.text[alias.text.length - 1]
      const before = text[cursor - 1] || ''
      const after = text[cursor + alias.text.length] || ''
      if (latin.test(first) && latin.test(before)) return false
      if (latin.test(last) && latin.test(after)) return false
      if (before === '_' || after === '_') return false
      if (alias.text.length === 1 && word.test(before + after)) return false
      return true
    })
    if (match) {
      spans.push({ text: text.slice(cursor, cursor + match.text.length), conceptId: match.conceptId })
      used.add(match.conceptId)
      cursor += match.text.length
    } else {
      const last = spans[spans.length - 1]
      if (last && !last.conceptId) last.text += text[cursor]
      else spans.push({ text: text[cursor] })
      cursor += 1
    }
  }
  return spans
}
