import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { toString } from 'mdast-util-to-string'
import { Check, Copy } from 'lucide-react'
import { linkConcepts } from './concepts'

type Node = { type: string; value?: string; url?: string; depth?: number; children?: Node[]; data?: { hProperties?: { id?: string } } }
export type Heading = { id: string; title: string; depth: number }
const slug = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section'

function remarkToolkit() {
  return (tree: Node) => {
    const counts = new Map<string, number>()
    function visit(node: Node) {
      if (node.type === 'heading') {
        const base = slug(toString(node as Parameters<typeof toString>[0]))
        const count = (counts.get(base) || 0) + 1
        counts.set(base, count)
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: count === 1 ? base : `${base}-${count}` } }
        return
      }
      if (node.type === 'paragraph') {
        const used = new Set<string>()
        function linkText(parent: Node) {
          if (!parent.children) return
          parent.children = parent.children.flatMap(child => {
            if (child.type === 'text' && child.value) return linkConcepts(child.value, used).map(span => span.conceptId
              ? { type: 'link', url: `#concept/${span.conceptId}`, children: [{ type: 'text', value: span.text }] }
              : { type: 'text', value: span.text })
            if (!['link', 'linkReference', 'inlineCode', 'code', 'html', 'image'].includes(child.type)) linkText(child)
            return [child]
          })
        }
        linkText(node)
        return
      }
      if (node.type === 'code' || node.type === 'html') return
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

export function getHeadings(body: string): Heading[] {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkToolkit)
  const tree = processor.runSync(processor.parse(body)) as Node
  const headings: Heading[] = []
  const visit = (node: Node) => {
    if (node.type === 'heading' && node.depth && node.depth >= 2 && node.depth <= 3) headings.push({ id: node.data?.hProperties?.id || '', title: toString(node as Parameters<typeof toString>[0]), depth: node.depth })
    node.children?.forEach(visit)
  }
  visit(tree)
  return headings
}

export default function ToolkitMarkdown({ body, onConcept, onCopy, copied }: { body: string; onConcept: (id: string) => void; onCopy?: (text: string, id: string) => void; copied?: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm, remarkToolkit]} components={{
    a: ({ href, children }) => href?.startsWith('#concept/')
      ? <button type="button" className="concept-link" onClick={() => onConcept(decodeURIComponent(href.slice(9)))}>{children}</button>
      : <a href={href} target={href?.startsWith('#') ? undefined : '_blank'} rel={href?.startsWith('#') ? undefined : 'noreferrer'}>{children}</a>,
    pre: ({ children }) => {
      const code = String((children as { props?: { children?: string } })?.props?.children || '')
      return <div className="code-block">{onCopy && <button onClick={() => onCopy(code, code)}>{copied === code ? <Check size={14}/> : <Copy size={14}/>} 複製</button>}<pre>{children}</pre></div>
    },
  }}>{body}</ReactMarkdown></div>
}
