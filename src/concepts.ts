import Fuse from 'fuse.js'
import rawConcepts from './concepts/concepts.json'
import rawAliases from './concepts/term_aliases_for_linking.json'

export type Concept = (typeof rawConcepts)[number]
export const concepts: Concept[] = rawConcepts
export const conceptById = new Map(concepts.map(concept => [concept.id, concept]))

const aliases = rawAliases.filter(alias => conceptById.has(alias.conceptId))
  .sort((a, b) => b.text.length - a.text.length)
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

export function searchConcepts(query: string, limit = 12): Concept[] {
  const needle = normalize(query)
  if (!needle) return concepts.slice(0, limit)
  const exactIds = new Set(aliases.filter(alias => normalize(alias.text) === needle).map(alias => alias.conceptId))
  const exact = concepts.filter(concept => exactIds.has(concept.id) || [concept.title, concept.english, ...concept.aliases].some(value => normalize(value) === needle))
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
