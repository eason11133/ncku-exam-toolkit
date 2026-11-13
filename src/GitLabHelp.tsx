import { useMemo, useState } from 'react'
import { Check, ChevronRight, Clipboard, ExternalLink, Search, Terminal, TriangleAlert } from 'lucide-react'
import data from './gitlab-help/data.json'
import './gitlab-help.css'

type Issue = {
  id: string
  kind: string
  title: string
  symptom: string
  cause: string
  fix: string[]
  code: string
  warning?: string
}
type Guide = { id: string; title: string; lead: string; code: string; notes: string[] }

const issues: Issue[] = data.issues
const guides: Guide[] = data.checklists
const kinds = ['全部', ...new Set(issues.map(issue => issue.kind))]

export default function GitLabHelp() {
  const [mode, setMode] = useState<'guides' | 'issues'>('guides')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('全部')
  const [openId, setOpenId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return issues.filter(issue =>
      (kind === '全部' || issue.kind === kind) &&
      (!q || [issue.title, issue.symptom, issue.cause, ...issue.fix, issue.code].join(' ').toLocaleLowerCase().includes(q))
    )
  }, [query, kind])

  async function copyText(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }

  function codePanel(id: string, content: string) {
    return <div className="gitlab-code">
      <div className="gitlab-code-head">
        <span>Terminal</span>
        <button type="button" onClick={() => void copyText(id, content)}>
          {copiedId === id ? <Check size={15}/> : <Clipboard size={15}/>}
          {copiedId === id ? '已複製' : '複製'}
        </button>
      </div>
      <pre><code>{content}</code></pre>
    </div>
  }

  return <div className="gitlab-help">
    <div className="gitlab-help-hero">
      <span className="eyebrow">考場操作速查</span>
      <h1>GitLab 操作與問題排查</h1>
      <p>{data.intro}</p>
      <div className="gitlab-help-switch" role="group" aria-label="GitLab 幫助分類">
        <button type="button" className={mode === 'guides' ? 'active' : ''} aria-pressed={mode === 'guides'} onClick={() => setMode('guides')}><Terminal size={17}/> 操作流程</button>
        <button type="button" className={mode === 'issues' ? 'active' : ''} aria-pressed={mode === 'issues'} onClick={() => setMode('issues')}><TriangleAlert size={17}/> 遇到問題</button>
      </div>
    </div>

    {mode === 'guides' ? <>
      <div className="gitlab-guide-grid">
        {guides.map((guide, index) => <section className="gitlab-panel" key={guide.id}>
          <span className="gitlab-step">流程 {index + 1}</span>
          <h2>{guide.title}</h2>
          <p>{guide.lead}</p>
          {codePanel(guide.id, guide.code)}
          {guide.notes.map(note => <p className="gitlab-short-note" key={note}>{note}</p>)}
        </section>)}
      </div>
    </> : <>
      <div className="gitlab-issue-controls">
        <label className="gitlab-issue-search"><Search size={18}/><input aria-label="搜尋 GitLab 錯誤" placeholder="貼錯誤關鍵字，例如 publickey、Failed、HTTP…" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <div className="gitlab-issue-filters" aria-label="錯誤類型">
          {kinds.map(value => <button type="button" key={value} aria-pressed={kind === value} className={kind === value ? 'active' : ''} onClick={() => setKind(value)}>{value}</button>)}
        </div>
      </div>
      <p className="gitlab-results">{filtered.length} 個問題</p>
      <div className="gitlab-issue-list">
        {filtered.map(issue => <article className="gitlab-issue" key={issue.id}>
          <button type="button" className="gitlab-issue-toggle" aria-expanded={openId === issue.id} onClick={() => setOpenId(openId === issue.id ? null : issue.id)}>
            <span><small>{issue.kind}</small><strong>{issue.title}</strong><span>{issue.symptom}</span></span>
            <ChevronRight size={19} className={openId === issue.id ? 'open' : ''}/>
          </button>
          {openId === issue.id && <div className="gitlab-issue-detail">
            <p><strong>原因：</strong>{issue.cause}</p>
            {issue.fix.map(item => <p key={item}><strong>處理：</strong>{item}</p>)}
            {issue.code && codePanel(issue.id, issue.code)}
            {issue.warning && <p className="gitlab-warning"><TriangleAlert size={16}/>{issue.warning}</p>}
          </div>}
        </article>)}
        {filtered.length === 0 && <div className="gitlab-empty">查不到，換個錯誤關鍵字試試。</div>}
      </div>
    </>}
    {copyError && <p role="alert" className="gitlab-copy-error">無法自動複製，請自行選取上方指令。</p>}
    <footer className="gitlab-help-sources">
      <span>相關官方文件：</span>
      <div>{data.sources.map(item => <a key={item.url} href={item.url} target="_blank" rel="noreferrer">{item.title}<ExternalLink size={14}/></a>)}</div>
    </footer>
  </div>
}
