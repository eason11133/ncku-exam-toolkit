# 成大程式工具箱

供個人準備成大資工上機考使用的技術查找網站。使用 React、TypeScript、Vite；網站為靜態頁面，不需帳號或外部 AI API。正式站點：[ncku-exam-toolkit-ebon.vercel.app](https://ncku-exam-toolkit-ebon.vercel.app)。

## 主要操作

1. 打開「效能優化解法庫」，輸入目前方法（例如 `SingleThreadedExecutor`、`PIO`）或效能症狀（例如「鎖競爭」）。
2. 搜尋結果先比較可能的優化方向、觀察指標與簡短說明。
3. 展開一個方案，檢查原理、適用條件、代價、行為差異、程式範例與來源。
4. 按「複製技術背景」或「複製給 LLM」，帶到考場提供的 LLM 中直接評估並嘗試修改程式。
5. 用「測試結果比較」記錄修改前後的實測結果；沒有方案保證一定較快。

目前收錄 47 筆方法、141 個方案和 92 篇教學文章。其中第一版 42 個方案有 42 篇各自連結的長文：原有 3 篇 SingleThreadedExecutor 長文，加上這次補入的 39 篇。第二版新增 33 筆方法、99 個方向與 33 篇方法主題教材；**這 99 個方向尚未各自配有獨立完整教學**，不能把方案摘要算成完整教材。內容仍是待查證草稿，`verified` 均為 `false`；程式範例及效能改善尚未實測。網站保留技術文章、指令速查、注音輸入、錯誤排查、官方文件、個人筆記和提示詞產生器。初版手動填入的指令、文件清單、錯誤案例與 Docker 文章已移除，相關頁面會顯示空狀態，待正式內容整理後加入。個人筆記、測試與流程紀錄留在瀏覽器 LocalStorage，可匯出 JSON。第一版內容對照見 [CONTENT_MAP.md](CONTENT_MAP.md)。

## 技術觀念庫

「技術觀念庫」從附件匯入 217 個詞條（139 個 Demo 相關、78 個延伸），與「技術知識庫」文章分開。全站搜尋會先顯示相符觀念，再分組顯示文章與解法。文章與解法教材的正文可點選術語，進入白話定義、例子、使用情境及相關內容；返回時會回到原文附近。Demo 相關只是教材分類，不代表詞彙已完整覆蓋或經硬體實測。

詞條原文放在 `src/concepts/concepts.json`，辨識別名放在 `src/concepts/term_aliases_for_linking.json`；同目錄另保留來源清單、涵蓋說明與人類可閱讀版。新增詞條時使用唯一 `id`，填寫 `title`、`english`、`aliases`、`category`、`coverage`、`explanation`、`example`、`whenToUse`、`source`。`relatedArticle.articleId` 指向現有 Markdown 文章；`exampleSolution.methodId` 與 `optionId` 指向現有優化方法及方案；`relatedConceptIds` 指向其他詞條。沒有真實目標時使用 `null` 或空陣列，勿建立假連結。增加需要在正文辨識的寫法時，同步更新別名 JSON，避免大小寫不敏感的重複別名指向不同詞條。執行 `npm test` 會檢查資料連結、別名衝突及 Markdown 顯示。

## LLM 分層教材導航

從首頁、側邊欄或技術知識庫的「我不知道該選哪篇」進入。先把題目提供給考場 LLM，再在網站逐層複製 Prompt，依 LLM 回覆的分類 ID 自行點選；中途可直接查看目前分類所有教材。候選頁列出真實觀念、文章、優化方法與方案，並提供最後一層的閱讀順序 Prompt。網站不另設題目輸入框、不呼叫 LLM API，也不自動解析它的回覆。

分類樹與三種 Prompt 模板分別放在 `src/navigation/taxonomy.json`、`src/navigation/prompt_templates.json`。觀念、文章、方法的主要與跨分類路徑分別放在 `concept_routes.json`、`article_routes.json`、`optimization_routes.json`；這些檔案只存 ID，頁面標題與摘要取自原本的內容資料。新增教材時加上對應 route；新增分類時修改樹與 route，不必改導覽元件。`node checks/validate_navigation.mjs` 會檢查所有現有內容均有有效分類，`npm run build` 也會先執行此檢查。

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
