import { ArrowLeft, ArrowRight, BookOpen, Search } from 'lucide-react'
import { articles } from './content'
import { optimizations } from './optimizations'
import { conceptById, type Concept } from './concepts'

type Props = {
  selected?: Concept
  concepts: Concept[]
  query: string
  onQuery: (query: string) => void
  onSelect: (id: string) => void
  onBack: () => void
  backLabel: string
  onNavigate: (view: 'knowledge' | 'performance', id: string) => void
}

export default function ConceptLibrary({ selected, concepts, query, onQuery, onSelect, onBack, backLabel, onNavigate }: Props) {
  if (selected) {
    const article = articles.find(item => item.id === selected.relatedArticle?.articleId)
    const method = optimizations.find(item => item.id === selected.exampleSolution?.methodId)
    const option = method?.options.find(item => item.id === selected.exampleSolution?.optionId)
    return <div className="concept-page">
      <button className="back-button" onClick={onBack}><ArrowLeft size={15}/> {backLabel}</button>
      <span className="eyebrow">技術觀念庫 / {selected.category}</span>
      <h1>{selected.title}</h1>
      {selected.english !== selected.title && <p className="concept-english">{selected.english}</p>}
      <div className="concept-detail">
        <section><h2>這是什麼</h2><p>{selected.plain}</p></section>
        <section><h2>逐步理解</h2><p>{selected.walkthrough}</p></section>
        <section><h2>常見誤解</h2><p>{selected.commonMistake}</p></section>
        <section><h2>具體例子</h2><p>{selected.example}</p></section>
        <section><h2>何時會用到</h2><p>{selected.whenToUse}</p></section>
        {selected.aliases.length > 0 && <section><h2>其他名稱</h2><p>{selected.aliases.join('、')}</p></section>}
        {selected.relatedConceptIds.length > 0 && <section><h2>相關觀念</h2><div className="concept-actions">{selected.relatedConceptIds.map(id => <button key={id} onClick={() => onSelect(id)}>{conceptById.get(id)?.title || id} <ArrowRight size={14}/></button>)}</div></section>}
        {(article || option) && <section><h2>接著看</h2><div className="concept-actions">{article && <button onClick={() => onNavigate('knowledge', article.id)}><BookOpen size={15}/> 教學文章：{article.title} <ArrowRight size={14}/></button>}{option && method && <button onClick={() => onNavigate('performance', `${method.id}::${option.id}`)}>優化方案：{method.name} → {option.title} <ArrowRight size={14}/></button>}</div></section>}
        <small>資料來源：{selected.source} · {selected.coverage === 'demo' ? 'Demo 觀念' : '延伸觀念'} · 尚未完成實機與全面人工查證</small>
      </div>
    </div>
  }
  return <div className="concept-page"><span className="eyebrow">資料查找</span><h1>技術觀念庫</h1><p className="concept-english">搜尋名詞或縮寫，先理解意思，再前往相關文章與解法。</p><label className="concept-search"><Search size={18}/><input value={query} onChange={event => onQuery(event.target.value)} placeholder="搜尋 PIO FIFO、DMA、DREQ、臨界區…" aria-label="搜尋技術觀念"/></label><p className="concept-count">{query.trim() ? `找到 ${concepts.length} 個觀念` : `收錄 ${concepts.length} 個觀念`}</p><div className="concept-list">{concepts.map(item => <button key={item.id} onClick={() => onSelect(item.id)}><span className="pill">{item.category}</span><strong>{item.title}</strong><small>{item.explanation}</small><ArrowRight size={16}/></button>)}</div></div>
}
