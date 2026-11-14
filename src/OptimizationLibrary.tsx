import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Check, ChevronDown, Copy, ExternalLink, Search } from 'lucide-react'
import ToolkitMarkdown from './ToolkitMarkdown'
import { articles, commands, docs } from './content'
import { optimizations } from './optimizations'
import { llmSuggestion, rankOptions, searchOptimizationMethods, technicalBackground } from './optimization-core'
import type { OptimizationMethod, OptimizationOption } from './optimization-core'
import { articleMarkdown } from './articleCopy'
import './optimization.css'

type Props = {
  selectedId: string | null
  onNavigate: (view: 'knowledge' | 'commands' | 'docs', id: string) => void
  onCopy: (value: string, id: string) => void
  copied: string
  onConcept: (id: string, origin: string) => void
}

export default function OptimizationLibrary({ selectedId, onNavigate, onCopy, copied, onConcept }: Props) {
  const selectedMethod = optimizations.find(item => item.id === selectedId?.split('::')[0])
  const [query, setQuery] = useState(selectedMethod?.name || '')
  const [openOption, setOpenOption] = useState<string | null>(selectedId?.includes('::') ? selectedId : null)
  const results = useMemo(() => searchOptimizationMethods(optimizations, query), [query])

  function showMethod(id: string) {
    const method = optimizations.find(item => item.id === id)
    if (method) { setQuery(method.name); setOpenOption(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  }

  return <div className="opt-library">
    <div className="opt-intro"><span className="eyebrow">從目前方法或效能問題開始</span><h1>效能優化解法庫</h1><p>先看可嘗試的方向與適用條件，再選方案複製給考場 LLM。內容仍須對照實際程式與來源驗證，沒有方案保證更快。</p></div>
    <label className="opt-search"><Search size={19}/><input value={query} onChange={event => { setQuery(event.target.value); setOpenOption(null) }} placeholder="搜尋 SingleThreadedExecutor、PIO、鎖競爭、訊息處理延遲…" aria-label="搜尋效能優化解法"/>{query && <button onClick={() => { setQuery(''); setOpenOption(null) }} aria-label="清除解法搜尋">清除</button>}</label>
    <div className="opt-search-meta"><span>{query ? `找到 ${results.length} 個方法` : `目前收錄 ${optimizations.length} 個方法`}</span><span>可用方法名稱、症狀、縮寫或方案名稱搜尋</span></div>
    {results.length === 0 ? <div className="opt-empty"><strong>目前沒有相符的解法資料</strong><p>可以換用英文名稱、中文症狀或縮寫；內容會持續新增。</p></div> : results.map(method => <MethodResult key={method.id} method={method} query={query} openOption={openOption} setOpenOption={setOpenOption} onCopy={onCopy} copied={copied} showMethod={showMethod} onNavigate={onNavigate} onConcept={onConcept}/>)}
  </div>
}

function MethodResult({ method, query, openOption, setOpenOption, onCopy, copied, showMethod, onNavigate, onConcept }: {
  method: OptimizationMethod; query: string; openOption: string | null; setOpenOption: (id: string | null) => void;
  onCopy: Props['onCopy']; copied: string; showMethod: (id: string) => void; onNavigate: Props['onNavigate']; onConcept: Props['onConcept'];
}) {
  return <section className="opt-method" aria-label={method.name}>
    <div className="opt-method-head"><div><span className="opt-kind">{method.category}</span><span className={`opt-state ${method.verified ? 'is-verified' : ''}`}>{method.verified ? '已查證' : '待查證'}</span><h2>{method.name}</h2><p>{method.summary}</p></div><span className="opt-count">{method.options.length} 個方向</span></div>
    <div className="opt-problems"><strong>常見瓶頸</strong><span>{method.bottlenecks.join(' ／ ')}</span></div>
    <div className="opt-options">{rankOptions(method, query).map(option => {
      const id = `${method.id}::${option.id}`
      const expanded = openOption === id
      return <div className={`opt-option ${expanded ? 'expanded' : ''}`} key={option.id}>
        <div className="opt-option-row"><button className="opt-option-main" aria-expanded={expanded} onClick={() => setOpenOption(expanded ? null : id)}><span><strong>{option.title}</strong><small>{option.summary}</small><em>{option.metrics.join(' · ')}</em></span><ChevronDown size={17}/></button><button className="opt-quick-copy" onClick={() => onCopy(llmSuggestion(method, option), `llm-${id}`)} title="複製給 LLM">{copied === `llm-${id}` ? <Check size={15}/> : <Copy size={15}/>} <span>複製給 LLM</span></button></div>
        {expanded && <OptionDetail method={method} option={option} onCopy={onCopy} copied={copied} onConcept={onConcept}/>}
      </div>
    })}</div>
    {(method.relatedMethodIds.length > 0 || method.articleIds.length > 0 || method.commandIds.length > 0 || method.docIds.length > 0) && <div className="opt-related"><strong>延伸查找</strong>{method.relatedMethodIds.map(id => { const item = optimizations.find(x => x.id === id); return item && <button key={id} onClick={() => showMethod(id)}>相關方法：{item.name} <ArrowRight size={13}/></button> })}{method.articleIds.map(id => { const item = articles.find(x => x.id === id); return item && <button key={id} onClick={() => onNavigate('knowledge', id)}>文章：{item.title} <ArrowRight size={13}/></button> })}{method.commandIds.map(id => { const item = commands.find(x => x.id === id); return item && <button key={id} onClick={() => onNavigate('commands', id)}>指令：{item.title} <ArrowRight size={13}/></button> })}{method.docIds.map(id => { const item = docs.find(x => x.id === id); return item && <button key={id} onClick={() => onNavigate('docs', id)}>文件：{item.title} <ArrowRight size={13}/></button> })}</div>}
  </section>
}

function OptionDetail({ method, option, onCopy, copied, onConcept }: { method: OptimizationMethod; option: OptimizationOption; onCopy: Props['onCopy']; copied: string; onConcept: Props['onConcept'] }) {
  const id = `${method.id}::${option.id}`
  const detailArticle = option.articleId ? articles.find(article => article.id === option.articleId) : undefined
  return <div className="opt-detail">
    <div className="opt-detail-grid"><div><h3>原理</h3><p>{option.principle}</p><h3>適用條件</h3><ul>{option.conditions.map(item => <li key={item}>{item}</li>)}</ul></div><div><h3>限制與代價</h3><ul>{option.tradeoffs.map(item => <li key={item}>{item}</li>)}</ul><h3>行為與正確性</h3><p>{option.behavior}</p></div></div>
    <p className="opt-metrics"><strong>觀察指標：</strong>{option.metrics.join('、')}</p>
    {option.code && <div className="opt-code"><div><span>範例 · {option.code.language}</span><button onClick={() => onCopy(option.code!.snippet, `code-${id}`)}>{copied === `code-${id}` ? <Check size={14}/> : <Copy size={14}/>} 複製程式碼</button></div><pre><code>{option.code.snippet}</code></pre></div>}
    {detailArticle && <article className="opt-long-form" aria-label={`${option.title}完整說明`}><div className="article-copy-row"><button onClick={() => onCopy(articleMarkdown(detailArticle), `full-${detailArticle.id}`)}><Copy size={15}/> {copied === `full-${detailArticle.id}` ? '已複製' : '複製全文給 LLM'}</button></div><ToolkitMarkdown body={detailArticle.body} onConcept={conceptId => onConcept(conceptId, id)} onCopy={onCopy} copied={copied}/></article>}
    <div className="opt-source"><BookOpen size={15}/><span>參考來源：</span>{option.sources.map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title} <ExternalLink size={12}/></a>)}</div>
    <div className="opt-detail-actions"><button onClick={() => onCopy(technicalBackground(method, option), `background-${id}`)}>{copied === `background-${id}` ? <Check size={15}/> : <Copy size={15}/>} 複製技術背景</button><button className="opt-copy-primary" onClick={() => onCopy(llmSuggestion(method, option), `llm-${id}`)}>{copied === `llm-${id}` ? <Check size={15}/> : <Copy size={15}/>} 複製給 LLM</button></div>
  </div>
}
