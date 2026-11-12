import { z } from 'zod'

const base = z.object({
  id: z.string().min(1), title: z.string().min(1), category: z.string().min(1),
  tags: z.array(z.string()).default([]), aliases: z.array(z.string()).default([]),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  priority: z.enum(['P0', 'P1', 'P2']).default('P1'),
  source_type: z.enum(['official', 'community', 'personal', 'speculative']),
  source_url: z.string().url().optional(), verified: z.boolean(),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), summary: z.string(),
  related: z.array(z.string()).default([]), body: z.string(),
})
export type Article = z.infer<typeof base>

const jsonModules = import.meta.glob('./content/*.json', { eager: true, import: 'default' })
const markdownModules = import.meta.glob('./content/*.md', { eager: true, query: '?raw', import: 'default' })

function parseMarkdown(raw: string): unknown {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) throw new Error('Markdown requires YAML front matter')
  const metadata: Record<string, unknown> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([a-z_]+):\s*(.*)$/)
    if (!pair) continue
    const value = pair[2].trim()
    metadata[pair[1]] = ['tags', 'aliases', 'related'].includes(pair[1])
      ? (value ? value.split(',').map(item => item.trim()) : [])
      : value === 'true' ? true : value === 'false' ? false : value
  }
  return { ...metadata, body: match[2] }
}

export const articles: Article[] = Object.entries({ ...jsonModules, ...Object.fromEntries(Object.entries(markdownModules).map(([path, raw]) => [path, parseMarkdown(raw as string)])) })
  .map(([path, value]) => {
    const result = base.safeParse(value)
    if (!result.success) throw new Error(`Invalid content ${path}: ${result.error.message}`)
    return result.data
  })

export type Command = { id: string; title: string; category: string; summary: string; syntax: string; options: string[]; example: string; caution: string; related: string[]; source: string; aliases?: string[] }
export const commands: Command[] = []

export type DocLink = { id: string; title: string; category: string; summary: string; url: string; version: string; topics: string[]; checkedAt: string }
export const docs: DocLink[] = []

export type Troubleshooting = { id: string; symptom: string; category: string; causes: string[]; diagnostics: string[]; checks: string[]; fixes: string[]; verification: string[]; source: string }
export const troubleshooting: Troubleshooting[] = []
