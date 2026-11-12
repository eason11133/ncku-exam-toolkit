import { ArrowLeft, ArrowRight, BookOpen, Check, Copy, Search } from 'lucide-react'
import { findNavigationNode, navigationCandidates, navigationCount, navigationPrompt, navigationReading, relatedNavigationNodes, taxonomy, type TaxonomyNode } from './navigation-core'
import './navigation.css'

type Props = {
  pathIds: string[]
  setPathIds: (ids: string[]) => void
  showCandidates: boolean
  setShowCandidates: (show: boolean) => void
  onCopy: (text: string, id: string) => void
  copied: string
  onOpenItem: (view: 'concepts' | 'knowledge' | 'performance', id: string) => void
  onSearch: () => void
}

export default function LessonNavigator(props: Props) {
  const { pathIds, setPathIds, showCandidates, setShowCandidates, onCopy, copied, onOpenItem, onSearch } = props
  const path = pathIds.map((_, index) => findNavigationNode(pathIds.slice(0, index + 1))).filter((node): node is TaxonomyNode => Boolean(node))
  const current = path.at(-1)
  const atCandidates = Boolean(current && (showCandidates || current.children.length === 0))
  const options = current?.children || taxonomy
  const prompt = navigationPrompt(path, atCandidates)
  const copyId = `navigation-${pathIds.join('/') || 'root'}-${atCandidates ? 'articles' : 'options'}`
  const goTo = (id: string) => { setPathIds([...pathIds, id]); setShowCandidates(false); window.scrollTo(0, 0) }
  const goBack = () => { if (showCandidates && current?.children.length) setShowCandidates(false); else setPathIds(pathIds.slice(0, -1)); window.scrollTo(0, 0) }

  return <div className="lesson-nav">
    <div className="lesson-nav-intro"><span className="eyebrow">教材查找 / LLM 分層導航</span><h1>我不知道該看哪篇</h1></div>
    <nav className="lesson-path" aria-label="目前分類路徑"><button onClick={() => { setPathIds([]); setShowCandidates(false) }}>全部分類</button>{path.map((node, index) => <span key={node.id}><ArrowRight size={14}/><button aria-current={index === path.length - 1 ? 'step' : undefined} onClick={() => { setPathIds(pathIds.slice(0, index + 1)); setShowCandidates(false) }}>{node.label}</button></span>)}</nav>
    <div className="lesson-stage-head"><div>{current && <button className="lesson-back" onClick={goBack}><ArrowLeft size={16}/> 返回上一層</button>}<span className="eyebrow">{!current ? '第 1 層 / 大分類' : atCandidates ? '教材文章' : '下一層 / 細分類'}</span><h2>{atCandidates ? `${current?.label}的教材文章` : current ? current.label : '先選最接近的領域'}</h2>{current && !atCandidates && <p>{current.question}</p>}</div><button className="lesson-copy" onClick={() => onCopy(prompt, copyId)}>{copied === copyId ? <Check size={17}/> : <Copy size={17}/>} {copied === copyId ? '已複製' : '複製給 LLM'}</button></div>
    {copied === 'error' && <p className="lesson-copy-error" role="alert">複製失敗。請展開下方 Prompt，手動選取文字複製。</p>}
    <details className="lesson-prompt-preview"><summary>查看這一層的 Prompt</summary><pre>{prompt}</pre></details>
    {!atCandidates ? <><div className="lesson-options">{options.map(node => <button key={node.id} className="lesson-option" onClick={() => goTo(node.id)}><span className="lesson-option-id">{node.id}</span><strong>{node.label}</strong><span>{node.question}</span><small>{node.hint}</small><em>{navigationCount(node)} 篇教材文章 <ArrowRight size={15}/></em></button>)}</div>{current && <div className="lesson-fallback"><button onClick={() => { setShowCandidates(true); window.scrollTo(0, 0) }}><BookOpen size={17}/> 直接看這個分類的教材文章</button><button onClick={onSearch}><Search size={17}/> 改用全站搜尋</button></div>}</> : <CandidateList node={current!} path={path} onChooseRelated={id => { setPathIds([...pathIds.slice(0, -1), id]); setShowCandidates(false); window.scrollTo(0, 0) }} onOpenItem={onOpenItem} onSearch={onSearch} onBack={goBack}/>}
  </div>
}

function CandidateList({ node, path, onChooseRelated, onOpenItem, onSearch, onBack }: { node: TaxonomyNode; path: TaxonomyNode[]; onChooseRelated: (id: string) => void; onOpenItem: Props['onOpenItem']; onSearch: () => void; onBack: () => void }) {
  const candidates = navigationCandidates(node)
  const reading = navigationReading(node)
  const direct = reading.filter(entry => !entry.related)
  const related = reading.filter(entry => entry.related)
  const siblings = direct.length ? [] : relatedNavigationNodes(path)
  const articleButton = ({ item, related: crossCategory, solutionLesson }: (typeof reading)[number]) => <CandidateButton key={item.id} id={item.id} title={item.title} summary={item.summary} related={crossCategory} kind={solutionLesson ? '解法教材' : '技術文章'} onClick={() => onOpenItem('knowledge', item.id)}/>
  return <div className="lesson-candidates">
    <p className="lesson-total">{direct.length} 篇本分類文章{related.length > 0 && `、${related.length} 篇跨分類相關文章`}</p>
    {direct.length > 0 ? <section className="lesson-primary"><h3>這個分類的教材文章 <small>{direct.length}</small></h3><div className="lesson-item-list">{direct.map(articleButton)}</div></section> : <div className="lesson-no-articles"><strong>這個分類目前沒有直接對應的教材文章。</strong><p>{related.length ? '下方有跨分類相關文章。' : '可改看相關分類，或返回上一層重新選擇。'}</p></div>}
    {related.length > 0 && <section><h3>跨分類相關教材 <small>{related.length}</small></h3><div className="lesson-item-list">{related.map(articleButton)}</div></section>}
    {siblings.length > 0 && <section><h3>相關分類</h3><div className="lesson-related-categories">{siblings.map(item => <button key={item.id} onClick={() => onChooseRelated(item.id)}><strong>{item.label}</strong><small>{item.id} · {navigationCount(item)} 篇教材文章</small><ArrowRight size={15}/></button>)}</div></section>}
    {candidates.methods.length > 0 && <details className="lesson-extra"><summary>優化方法速查（{candidates.methods.length} 個，部分僅有方案摘要）</summary><div className="lesson-item-list">{candidates.methods.map(({ item, related: crossCategory }) => <div className="lesson-method" key={item.id}><CandidateButton id={item.id} title={item.name} summary={item.summary} related={crossCategory} kind="方法摘要" onClick={() => onOpenItem('performance', item.id)}/><div className="lesson-method-options">{item.options.map(option => <CandidateButton key={option.id} id={`${item.id}::${option.id}`} title={option.title} summary={option.summary} related={crossCategory} kind={option.articleId ? '附完整教材' : '方案摘要'} onClick={() => onOpenItem('performance', `${item.id}::${option.id}`)}/>)}</div></div>)}</div></details>}
    {candidates.concepts.length > 0 && <details className="lesson-extra"><summary>查不懂的術語（{candidates.concepts.length} 個觀念）</summary><div className="lesson-item-list">{candidates.concepts.map(({ item, related: crossCategory }) => <CandidateButton key={item.id} id={item.id} title={item.title} summary={item.explanation} related={crossCategory} kind={item.coverage === 'demo' ? 'Demo 相關觀念' : '延伸觀念'} onClick={() => onOpenItem('concepts', item.id)}/>)}</div></details>}
    <div className="lesson-fallback"><button onClick={onBack}><ArrowLeft size={17}/> 返回上一層</button><button onClick={onSearch}><Search size={17}/> 改用全站搜尋</button></div>
  </div>
}

function CandidateButton({ id, title, summary, related, kind, onClick }: { id: string; title: string; summary: string; related: boolean; kind: string; onClick: () => void }) { return <button className="lesson-item" onClick={onClick}><span><strong>{title}</strong><span className="lesson-item-tags"><em>{kind}</em>{related && <em>跨分類相關</em>}</span><small>{id}</small><span className="lesson-item-summary">{summary}</span></span><ArrowRight size={16}/></button> }
