import { ArrowLeft, ArrowRight, BookOpen, Check, Copy, Search } from 'lucide-react'
import { findNavigationNode, navigationCandidates, navigationCount, navigationPrompt, taxonomy, type TaxonomyNode } from './navigation-core'
import './navigation.css'

type Props = {
  pathIds: string[]
  setPathIds: (ids: string[]) => void
  showCandidates: boolean
  setShowCandidates: (show: boolean) => void
  question: string
  setQuestion: (value: string) => void
  givenToLlm: boolean
  setGivenToLlm: (value: boolean) => void
  onCopy: (text: string, id: string) => void
  copied: string
  onOpenItem: (view: 'concepts' | 'knowledge' | 'performance', id: string) => void
  onSearch: () => void
}

export default function LessonNavigator(props: Props) {
  const { pathIds, setPathIds, showCandidates, setShowCandidates, question, setQuestion, givenToLlm, setGivenToLlm, onCopy, copied, onOpenItem, onSearch } = props
  const path = pathIds.map((_, index) => findNavigationNode(pathIds.slice(0, index + 1))).filter((node): node is TaxonomyNode => Boolean(node))
  const current = path.at(-1)
  const atCandidates = Boolean(current && (showCandidates || current.children.length === 0))
  const options = current?.children || taxonomy
  const prompt = navigationPrompt(path, question, givenToLlm, atCandidates)
  const copyId = `navigation-${pathIds.join('/') || 'root'}-${atCandidates ? 'articles' : 'options'}`
  const goTo = (id: string) => { setPathIds([...pathIds, id]); setShowCandidates(false); window.scrollTo(0, 0) }
  const goBack = () => { if (showCandidates && current?.children.length) setShowCandidates(false); else setPathIds(pathIds.slice(0, -1)); window.scrollTo(0, 0) }

  return <div className="lesson-nav">
    <div className="lesson-nav-intro"><span className="eyebrow">教材查找 / LLM 分層導航</span><h1>我不知道該看哪篇</h1><p>把當層 Prompt 複製給考場 LLM，再依它回覆的 ID，自己點選網站分類。隨時可停止細分，直接查看全部教材。</p></div>
    <div className="lesson-context"><label htmlFor="lesson-question">題目或遇到的狀況（可選）</label><textarea id="lesson-question" value={question} onChange={event => setQuestion(event.target.value)} rows={3} placeholder="可貼題目摘要、錯誤訊息或少量程式碼；內容只留在此頁，不會上傳。"/><label className="lesson-checkbox"><input type="checkbox" checked={givenToLlm} onChange={event => setGivenToLlm(event.target.checked)}/> 題目已提供給考場 LLM</label></div>
    <nav className="lesson-path" aria-label="目前分類路徑"><button onClick={() => { setPathIds([]); setShowCandidates(false) }}>全部分類</button>{path.map((node, index) => <span key={node.id}><ArrowRight size={14}/><button aria-current={index === path.length - 1 ? 'step' : undefined} onClick={() => { setPathIds(pathIds.slice(0, index + 1)); setShowCandidates(false) }}>{node.label}</button></span>)}</nav>
    <div className="lesson-stage-head"><div>{current && <button className="lesson-back" onClick={goBack}><ArrowLeft size={16}/> 返回上一層</button>}<span className="eyebrow">{!current ? '第 1 層 / 大分類' : atCandidates ? '教材候選' : '下一層 / 細分類'}</span><h2>{atCandidates ? `${current?.label}的全部教材` : current ? current.label : '先選最接近的領域'}</h2><p>{atCandidates ? '以下都是真實存在的內容。可直接點開，也可請 LLM 從這份封閉清單建議閱讀順序。' : current ? current.question : 'LLM 最多建議兩個分類；若跨主題，可返回這裡走第二條路徑。'}</p></div><button className="lesson-copy" onClick={() => onCopy(prompt, copyId)}>{copied === copyId ? <Check size={17}/> : <Copy size={17}/>} {copied === copyId ? '已複製' : '複製給 LLM'}</button></div>
    {copied === 'error' && <p className="lesson-copy-error" role="alert">複製失敗。請展開下方 Prompt，手動選取文字複製。</p>}
    <details className="lesson-prompt-preview"><summary>查看這一層的 Prompt</summary><pre>{prompt}</pre></details>
    {!atCandidates ? <><div className="lesson-options">{options.map(node => <button key={node.id} className="lesson-option" onClick={() => goTo(node.id)}><span className="lesson-option-id">{node.id}</span><strong>{node.label}</strong><span>{node.question}</span><small>{node.hint}</small><em>{navigationCount(node)} 筆相關內容 <ArrowRight size={15}/></em></button>)}</div>{current && <div className="lesson-fallback"><button onClick={() => { setShowCandidates(true); window.scrollTo(0, 0) }}><BookOpen size={17}/> 直接看這個分類的全部教材</button><button onClick={onSearch}><Search size={17}/> 改用全站搜尋</button></div>}</> : <CandidateList node={current!} onOpenItem={onOpenItem} onSearch={onSearch} onBack={goBack}/>}
  </div>
}

function CandidateList({ node, onOpenItem, onSearch, onBack }: { node: TaxonomyNode; onOpenItem: Props['onOpenItem']; onSearch: () => void; onBack: () => void }) {
  const candidates = navigationCandidates(node)
  const demo = candidates.concepts.filter(({ item }) => item.coverage === 'demo')
  const extension = candidates.concepts.filter(({ item }) => item.coverage !== 'demo')
  const total = candidates.concepts.length + candidates.articles.length + candidates.methods.length
  return <div className="lesson-candidates"><p className="lesson-total">本分類有 {candidates.concepts.length} 個觀念、{candidates.articles.length} 篇文章、{candidates.methods.length} 個優化方法；下方顯示全部內容。</p>
    <section><h3>先懂觀念 · Demo 相關 <small>{demo.length}</small></h3><div className="lesson-item-list">{demo.map(({ item, related }) => <CandidateButton key={item.id} id={item.id} title={item.title} summary={item.explanation} related={related} onClick={() => onOpenItem('concepts', item.id)}/>)}</div></section>
    <section><h3>先懂觀念 · 延伸 <small>{extension.length}</small></h3><div className="lesson-item-list">{extension.map(({ item, related }) => <CandidateButton key={item.id} id={item.id} title={item.title} summary={item.explanation} related={related} onClick={() => onOpenItem('concepts', item.id)}/>)}</div></section>
    <section><h3>再看技術文章 <small>{candidates.articles.length}</small></h3><div className="lesson-item-list">{candidates.articles.map(({ item, related }) => <CandidateButton key={item.id} id={item.id} title={item.title} summary={item.summary} related={related} onClick={() => onOpenItem('knowledge', item.id)}/>)}</div></section>
    <section><h3>再看優化方法與方案 <small>{candidates.methods.length}</small></h3><div className="lesson-item-list">{candidates.methods.map(({ item, related }) => <div className="lesson-method" key={item.id}><CandidateButton id={item.id} title={item.name} summary={item.summary} related={related} onClick={() => onOpenItem('performance', item.id)}/><div className="lesson-method-options">{item.options.map(option => <CandidateButton key={option.id} id={`${item.id}::${option.id}`} title={option.title} summary={option.summary} related={related} onClick={() => onOpenItem('performance', `${item.id}::${option.id}`)}/>)}</div></div>)}</div></section>
    {total === 0 && <p className="lesson-empty">這個分類目前沒有教材。可返回上一層或改用全站搜尋。</p>}
    <div className="lesson-fallback"><button onClick={onBack}><ArrowLeft size={17}/> 返回上一層</button><button onClick={onSearch}><Search size={17}/> 改用全站搜尋</button></div>
  </div>
}

function CandidateButton({ id, title, summary, related, onClick }: { id: string; title: string; summary: string; related: boolean; onClick: () => void }) { return <button className="lesson-item" onClick={onClick}><span><strong>{title}</strong>{related && <em>跨分類相關</em>}<small>{id}</small><span className="lesson-item-summary">{summary}</span></span><ArrowRight size={16}/></button> }
