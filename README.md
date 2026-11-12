# 成大程式工具箱

供個人準備成大資工上機考使用的技術查找網站。使用 React、TypeScript、Vite；網站為靜態頁面，不需帳號或外部 AI API。正式站點：[ncku-exam-toolkit-ebon.vercel.app](https://ncku-exam-toolkit-ebon.vercel.app)。

## 主要操作

1. 打開「效能優化解法庫」，輸入目前方法（例如 `SingleThreadedExecutor`、`PIO`）或效能症狀（例如「鎖競爭」）。
2. 搜尋結果先比較可能的優化方向、觀察指標與簡短說明。
3. 展開一個方案，檢查原理、適用條件、代價、行為差異、程式範例與來源。
4. 按「複製技術背景」或「複製給 LLM」，帶到考場提供的 LLM 中直接評估並嘗試修改程式。
5. 用「測試結果比較」記錄修改前後的實測結果；沒有方案保證一定較快。

目前收錄 47 筆方法、141 個方案和 92 篇教學文章。其中第一版 42 個方案有 42 篇各自連結的長文：原有 3 篇 SingleThreadedExecutor 長文，加上這次補入的 39 篇。第二版新增 33 筆方法、99 個方向與 33 篇方法主題教材；**這 99 個方向尚未各自配有獨立完整教學**，不能把方案摘要算成完整教材。內容仍是待查證草稿，`verified` 均為 `false`；程式範例及效能改善尚未實測。網站保留技術文章、指令速查、注音輸入、錯誤排查、官方文件、個人筆記和提示詞產生器。初版手動填入的指令、文件清單、錯誤案例與 Docker 文章已移除，相關頁面會顯示空狀態，待正式內容整理後加入。個人筆記、測試與流程紀錄留在瀏覽器 LocalStorage，可匯出 JSON。第一版內容對照見 [CONTENT_MAP.md](CONTENT_MAP.md)。

## 本機開發與部署

```sh
npm install
npm run dev
npm run build
npm test
python checks/validate_content.py
python checks/validate_handoff_links.py
```

`npm run build` 會執行 TypeScript 檢查並產生 `dist/`。GitHub `main` 已連接 Vercel 正式部署。

## 新增優化解法內容

在 `src/optimizations/` 新增一個 `.json` 檔即可；Vite 會自動載入，不需修改 React 元件。每個檔案代表一個**目前使用的方法**，其 `options` 可包含多個優化方案。搜尋會索引方法名稱、別名、問題、瓶頸、方案名稱、方案別名與條件。請把中英文名稱及常見縮寫放入 `aliases`，把使用者實際可能輸入的症狀放入 `problems`。

可直接複製 [SingleThreadedExecutor 方法資料](src/optimizations/single-threaded-executor.json) 或 [ROS 2 完整教學文章](src/content/ros2-ste-short-callback.md) 當作新增內容的起點；兩者都是真正載入網站的檔案。更換 ID、標題、說明、條件及來源後，再依內容實際的查證狀態設定 `verified`。方法資料的 `options` 可列出多個方案；每個方案要說明 `principle`、`conditions`、`tradeoffs`、`behavior`、`metrics` 和 `sources`。`code` 可省略，但提供時應與說明和前提一致。`relatedMethodIds` 連到其他解法檔的 `id`；`articleIds`、`commandIds`、`docIds` 分別連到文章、指令及文件 ID。資料以 Zod 驗證，格式錯誤會在載入時明確報錯；同一方法內的方案 ID 必須唯一。

若某個方案有完整教學，可在該方案加上 `"articleId": "文章-id"`，指向 `src/content/` 的 Markdown 文章；展開方案時會在原頁面直接顯示全文。沒有此欄位的方案仍顯示原有 JSON 詳情。範例見 `src/optimizations/single-threaded-executor.json` 與三篇 `src/content/ros2-ste-*.md`。

原有知識庫文章仍放在 `src/content/`，支援帶 YAML front matter 的 Markdown 或 JSON。新增解法資料可用 `articleIds` 與既有文章連結。`src/optimization-core.ts` 提供搜尋與複製文字組合；`src/OptimizationLibrary.tsx` 是呈現頁面，新增內容通常不必更動它。

## 注音輸入來源

注音輸入使用 [OpenVanilla McBopomofoWeb](https://github.com/openvanilla/McBopomofoWeb) 2.1.0 的瀏覽器版本，檔案與 MIT 授權保留在 `public/ime/`。本站另加候選字點選與複製文字的操作。原專案授權請見 [public/ime/LICENSE.txt](public/ime/LICENSE.txt)。
