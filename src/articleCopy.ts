import type { Article } from './content'

export function articleMarkdown(article: Pick<Article, 'title' | 'body'>): string {
  const body = article.body.trim()
  const firstHeading = body.match(/^#\s+(.+)\r?\n/)
  return firstHeading?.[1].trim() === article.title.trim()
    ? `${body}\n`
    : `# ${article.title}\n\n${body}\n`
}
