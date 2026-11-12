import { z } from 'zod'

const source = z.object({ title: z.string().min(1), url: z.url() })
const option = z.object({
  id: z.string().min(1), title: z.string().min(1), aliases: z.array(z.string()).default([]),
  summary: z.string().min(1), principle: z.string().min(1),
  conditions: z.array(z.string()).min(1), tradeoffs: z.array(z.string()).min(1),
  behavior: z.string().min(1), metrics: z.array(z.string()).min(1),
  articleId: z.string().min(1).optional(),
  code: z.object({ language: z.string(), snippet: z.string().min(1) }).optional(),
  sources: z.array(source).min(1), verified: z.boolean(),
})
export const optimizationMethodSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), aliases: z.array(z.string()).default([]),
  category: z.string().min(1), summary: z.string().min(1),
  problems: z.array(z.string()).min(1), bottlenecks: z.array(z.string()).min(1),
  verified: z.boolean(), updatedAt: z.iso.date(), sources: z.array(source).min(1),
  relatedMethodIds: z.array(z.string()).default([]), articleIds: z.array(z.string()).default([]),
  commandIds: z.array(z.string()).default([]), docIds: z.array(z.string()).default([]),
  options: z.array(option).min(1),
})
