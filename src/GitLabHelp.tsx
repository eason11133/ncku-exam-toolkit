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
  const [openId, setOpenId] = useState<string | null>(issues[0]?.id || null)
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
        <span>Terminal 指令（先確認目前專案與分支）</span>
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
      <div className="gitlab-flow">
        <div><strong>VS Code</strong><small>修改、執行測試</small></div>
        <ChevronRight size={17}/>
        <div><strong>Git</strong><small>Commit、Push</small></div>
        <ChevronRight size={17}/>
        <div><strong>GitLab</strong><small>Pipeline、Job Log</small></div>
      </div>
      <div className="gitlab-guide-grid">
        {guides.map((guide, index) => <section className="gitlab-panel" key={guide.id}>
          <span className="gitlab-step">流程 {index + 1}</span>
          <h2>{guide.title}</h2>
          <p>{guide.lead}</p>
          {codePanel(guide.id, guide.code)}
          <ul>{guide.notes.map(note => <li key={note}>{note}</li>)}</ul>
        </section>)}
      </div>
      <div className="gitlab-notice">
        <strong>今天實際練過的 Demo</strong>
        <p>練習專案的 <code>.gitlab-ci.yml</code> 用 Python 3.12 執行 <code>hello.py</code>；原本少了右括號，修正後 Job #756 Passed。這證明你會找到 Job Log 和修正錯誤，<strong>不代表今年正式考試的評分規則相同</strong>。</p>
      </div>
    </> : <>
      <div className="gitlab-issue-controls">
        <label className="gitlab-issue-search"><Search size={18}/><input aria-label="搜尋 GitLab 錯誤" placeholder="貼錯誤關鍵字，例如 publickey、Failed、HTTP…" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <div className="gitlab-issue-filters" aria-label="錯誤類型">
          {kinds.map(value => <button type="button" key={value} aria-pressed={kind === value} className={kind === value ? 'active' : ''} onClick={() => setKind(value)}>{value}</button>)}
        </div>
      </div>
      <p className="gitlab-results">{filtered.length} 個可能相關的問題。請先比對錯誤原文，不要直接照貼會改動設定的指令。</p>
      <div className="gitlab-issue-list">
        {filtered.map(issue => <article className="gitlab-issue" key={issue.id}>
          <button type="button" className="gitlab-issue-toggle" aria-expanded={openId === issue.id} onClick={() => setOpenId(openId === issue.id ? null : issue.id)}>
            <span><small>{issue.kind}</small><strong>{issue.title}</strong><span>{issue.symptom}</span></span>
            <ChevronRight size={19} className={openId === issue.id ? 'open' : ''}/>
          </button>
          {openId === issue.id && <div className="gitlab-issue-detail">
            <p><strong>為什麼發生：</strong>{issue.cause}</p>
            <strong>怎麼檢查：</strong>
            <ol>{issue.fix.map(item => <li key={item}>{item}</li>)}</ol>
            {codePanel(issue.id, issue.code)}
            {issue.warning && <p className="gitlab-warning"><TriangleAlert size={16}/>{issue.warning}</p>}
          </div>}
        </article>)}
        {filtered.length === 0 && <div className="gitlab-empty">沒有符合的問題。試著改用錯誤英文關鍵字搜尋，或直接看 Job Log。</div>}
      </div>
    </>}
    {copyError && <p role="alert" className="gitlab-copy-error">無法自動複製，請自行選取上方指令。</p>}
    <footer className="gitlab-help-sources">
      <h2>查證與限制</h2>
      <p>考試實際的 Clone 網址、分支、Commit 前綴、評分觸發條件及 Runner 排隊情況，都以今年現場公告為準。連線故障優先聯絡現場人員，不要自行停用安全檢查。</p>
      <div>{data.sources.map(item => <a key={item.url} href={item.url} target="_blank" rel="noreferrer">{item.title}<ExternalLink size={14}/></a>)}</div>
    </footer>
  </div>
}
