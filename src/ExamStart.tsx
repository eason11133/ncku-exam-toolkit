import { useState } from 'react'
import { Copy } from 'lucide-react'
import { toolIntroPrompt } from './examPrompt'

const prompts = [
  { title: '告訴 LLM 我有什麼工具', text: toolIntroPrompt },
  { title: '先理解題目與專案', text: '先閱讀我提供的題目、README 與程式。請列出程式入口、輸入輸出、必要的資料順序、編譯或執行方式、現有測試與限制。資訊不足時指出要我提供哪個檔案或輸出；在理解前先不要修改程式。' },
  { title: '分析效能瓶頸', text: '根據我提供的原始碼與實測資料，區分已觀察到的瓶頸與假設。指出應先量測的位置、可嘗試的方案、必要條件、可能改變的行為，以及應保留的正確性。不要捏造測試數字。' },
  { title: '比較修改前後', text: '請先確認兩版使用相同輸入、工作量與環境，且正確性都通過，再比較時間、CPU 和記憶體。若資料不可比，指出缺少的條件，不要宣稱加速。' },
]

export default function ExamStart({ onCopy, copied, onNavigate }: { onCopy: (text: string, id: string) => void; copied: string; onNavigate: (view: 'knowledge' | 'performance' | 'troubleshooting') => void }) {
  const [shell, setShell] = useState<'powershell' | 'bash'>('powershell')
  const commands = shell === 'powershell'
    ? 'Get-Location\nGet-ChildItem\ngcc --version\npython --version\ndocker --version\ngit status'
    : 'pwd\nls -la\ngcc --version\npython3 --version\ndocker --version\ngit status'
  return <details className="exam-start">
    <summary><strong>考試開始</strong><span>環境確認、理解專案、記錄原始結果，再分析優化</span></summary>
    <div className="exam-start-body">
      <p>先把需要的提示詞複製給本地 LLM；網站資料由你自己查閱、貼回。</p>
      {prompts.map((prompt, index) => <div className="exam-step" key={prompt.title}><strong>{index + 1}. {prompt.title}</strong><button onClick={() => onCopy(prompt.text, `exam-${index}`)}><Copy size={14}/> {copied === `exam-${index}` ? '已複製' : '複製提示詞'}</button><p>{prompt.text}</p></div>)}
      <div className="exam-step"><strong>確認考試環境</strong><label>終端機 <select value={shell} onChange={event => setShell(event.target.value as typeof shell)}><option value="powershell">PowerShell</option><option value="bash">Bash</option></select></label><button onClick={() => onCopy(commands, 'exam-commands')}><Copy size={14}/> {copied === 'exam-commands' ? '已複製' : '複製安全指令'}</button><pre>{commands}</pre><small>只執行已安裝工具；指令失敗時先記錄輸出。</small></div>
      <div className="exam-step"><strong>記錄原始版本</strong><p>寫下測試輸入、正確性、時間、CPU 與記憶體。尚未量測的欄位標「未量測」，不要推測。</p></div>
      <div className="exam-start-links"><button onClick={() => onNavigate('knowledge')}>技術文章</button><button onClick={() => onNavigate('performance')}>效能解法</button><button onClick={() => onNavigate('troubleshooting')}>錯誤排查</button></div>
    </div>
  </details>
}
