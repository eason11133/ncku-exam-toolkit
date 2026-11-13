import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

for (const name of fs.readdirSync('src/content').filter(name => name.endsWith('.md'))) {
  const raw = fs.readFileSync(path.join('src/content', name), 'utf8')
  const body = raw.replace(/^---[\s\S]*?---\s*/, '')
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, body))
  const visible = html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '')
  if (visible.includes('**')) console.log(name, (visible.match(/.{0,25}\*\*.{0,65}/g) || []).slice(0, 3).join(' | '))
}
