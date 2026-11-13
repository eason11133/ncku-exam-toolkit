import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import paths from './learning-paths/paths.json'
import rosGuide from './learning-paths/01_先查資料流_再查ROS2通訊.md?raw'
import pthreadGuide from './learning-paths/02_從資料競爭到正確關閉_pthread.md?raw'
import pioGuide from './learning-paths/03_PIO與Transfer_把資料搬到對的位置.md?raw'
import { articles } from './content'

const guides = [rosGuide, pthreadGuide, pioGuide]
const titles = new Map(articles.map(article => [article.id, article.title]))

export default function LearningPaths({ onOpenArticle }: { onOpenArticle: (id: string) => void }) {
  return <section className="learning-paths" aria-label="跨章節學習路線">
    <h2>跨章節學習路線</h2>
    <p>從具體問題開始，依序讀文章，最後用題目檢查是否理解。</p>
    {paths.map((path, index) => <details key={path.id} className="learning-path">
      <summary>{path.title}</summary>
      <p><strong>先回答：</strong>{path.question}</p>
      <div className="learning-path-articles">{path.articleIds.map(id => <button key={id} onClick={() => onOpenArticle(id)}>{titles.get(id) || id}</button>)}</div>
      <div className="learning-path-guide"><ReactMarkdown remarkPlugins={[remarkGfm]}>{guides[index]}</ReactMarkdown></div>
    </details>)}
  </section>
}
