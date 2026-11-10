# 成大程式工具箱

供個人準備成大資工上機考使用的技術查找網站。使用 React、TypeScript、Vite；網站為靜態頁面，不需帳號或外部 AI API。正式站點：[ncku-exam-toolkit-ebon.vercel.app](https://ncku-exam-toolkit-ebon.vercel.app)。

## 主要操作

1. 打開「效能優化解法庫」，輸入目前方法（例如 `Mutex`、`BFS`）或效能症狀（例如「鎖競爭」）。
2. 搜尋結果先比較可能的優化方向、觀察指標與簡短說明。
3. 展開一個方案，檢查原理、適用條件、代價、行為差異、程式範例與來源。
4. 按「複製技術背景」或「複製給 LLM」，帶到考場提供的 LLM 中直接評估並嘗試修改程式。
5. 用「測試結果比較」記錄修改前後的實測結果；沒有方案保證一定較快。

目前只收錄 `Mutex`、`BFS`、`Memory Copy` 三筆**示範資料**，並標為「示範・待查證」。它們用來展示結構和操作，不代表已完成正式內容審查。正式資料應逐筆核對來源、平台條件與語意。網站也保留技術文章、指令速查、注音輸入、錯誤排查、官方文件、個人筆記和提示詞產生器。個人筆記、測試與流程紀錄留在瀏覽器 LocalStorage，可匯出 JSON。

## 本機開發與部署

```sh
npm install
npm run dev
npm run build
npm test
```

`npm run build` 會執行 TypeScript 檢查並產生 `dist/`。GitHub `main` 已連接 Vercel 正式部署。

## 新增優化解法內容

在 `src/optimizations/` 新增一個 `.json` 檔即可；Vite 會自動載入，不需修改 React 元件。每個檔案代表一個**目前使用的方法**，其 `options` 可包含多個優化方案。搜尋會索引方法名稱、別名、問題、瓶頸、方案名稱、方案別名與條件。請把中英文名稱及常見縮寫放入 `aliases`，把使用者實際可能輸入的症狀放入 `problems`。

可直接複製 [src/optimizations/mutex.json](src/optimizations/mutex.json) 作為完整範例，或從下列精簡範例開始。替換 ID、內容與來源後再放入 `src/optimizations/`：

```json
{
  "id": "unique-method-id",
  "name": "方法名稱",
  "aliases": ["English name", "中文別名", "縮寫"],
  "category": "技術分類",
  "summary": "一句話說明目前方法。",
  "problems": ["使用者會搜尋的效能症狀"],
  "bottlenecks": ["此方法在特定情況下可能遇到的瓶頸"],
  "verified": false,
  "updatedAt": "2026-11-10",
  "sources": [{"title": "來源名稱", "url": "https://example.org/reference"}],
  "relatedMethodIds": [],
  "articleIds": [],
  "commandIds": [],
  "docIds": [],
  "options": [
    {
      "id": "unique-option-id",
      "title": "優化方案名稱",
      "aliases": ["方案別名"],
      "summary": "搜尋結果中的一句話摘要。",
      "principle": "此方案如何運作。",
      "conditions": ["何時適用；必須檢查的前提"],
      "tradeoffs": ["可能增加的成本或退化情況"],
      "behavior": "是否改變正確性、順序、可見性或輸入輸出語意。",
      "metrics": ["延遲", "CPU 使用率"],
      "code": {"language": "cpp", "snippet": "// 可選：最小且完整標註前提的範例"},
      "sources": [{"title": "此方案的來源", "url": "https://example.org/option"}],
      "verified": false
    }
  ]
}
```

`code` 可省略。`sources` 請填真正可查的文件，勿保留範例網址。確認內容與來源、平台、版本、適用條件後，才把對應的 `verified` 設為 `true`。`relatedMethodIds` 連到其他解法檔的 `id`；`articleIds`、`commandIds`、`docIds` 分別連到既有文章、指令及官方文件 ID。資料以 Zod 驗證，格式錯誤會在載入時明確報錯；同一方法內的方案 ID 必須唯一。

原有知識庫文章仍放在 `src/content/`，支援帶 YAML front matter 的 Markdown 或 JSON。新增解法資料可用 `articleIds` 與既有文章連結。`src/optimization-core.ts` 提供搜尋與複製文字組合；`src/OptimizationLibrary.tsx` 是呈現頁面，新增內容通常不必更動它。

## 注音輸入來源

注音輸入使用 [OpenVanilla McBopomofoWeb](https://github.com/openvanilla/McBopomofoWeb) 2.1.0 的瀏覽器版本，檔案與 MIT 授權保留在 `public/ime/`。本站另加候選字點選與複製文字的操作。原專案授權請見 [public/ime/LICENSE.txt](public/ime/LICENSE.txt)。
