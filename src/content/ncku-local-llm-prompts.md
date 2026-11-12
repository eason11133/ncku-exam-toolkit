---
id: ncku-local-llm-prompts
title: 考場本地 LLM：讀陌生專案、修改、驗證的簡短指令
category: AI-Assisted Development
tags: LLM, prompts, unknown project, code review, GitLab, debugging
aliases: 考場 AI, prompt, 複製給 LLM, 優化指令
difficulty: beginner
priority: P0
source_type: personal
source_url: https://git-scm.com/docs
verified: false
updated_at: 2026-11-12
summary: 沒有檔案上傳、貼上程式碼有限制時，讓本地 LLM 只看必要範圍，提出可驗證的小修改。
related: ncku-performance-benchmark, ncku-gitlab-workflow
---
# 考場 LLM 指令：直接複製再填內容

這份頁面是給**考場提供的本地 LLM** 使用。網站自己不呼叫外部 AI，也不需要把整份 Repository 貼上去。先在 Terminal 找到檔案和相關函式，再貼最小必要段落。

## 1. 看懂陌生專案

> 我使用的是（語言／環境）。下面是專案目錄與主要檔案片段。請先找出輸入、處理、輸出三段的程式位置，說明資料怎麼流動、每段的主要成本，以及哪些觀察能確認瓶頸。先不要重寫專案；若資訊不足，請告訴我需要哪一個檔案、函式或日誌。

## 2. 找真正瓶頸

> 目前症狀：（填現象）。輸入規模：（填）。正確輸出：（填）。下面是相關程式及目前計時結果。請區分 CPU-bound、I/O-bound、lock contention 或 memory bottleneck，按「需要更少修改、能保留正確性、容易測試」排序方案。每個方案說明適用前提和何時會變慢。

## 3. 做最小修改

> 請根據現有程式，只修改造成問題的部分，不要改 public interface、輸入／輸出格式和必要順序。逐檔說明修改位置，提供可貼回原檔的程式碼片段；不能確定的 API 請先指出要查哪份官方文件。完成後列出編譯指令、正確性測試、效能比較步驟。

## 4. 編譯失敗

> 下面是第一個編譯／連結錯誤與相關檔案。先判斷是語法、型別、符號、缺依賴還是連結設定。請給最小修正並指出原因。不要省略錯誤處理，也不要用強制型別轉換掩蓋問題。

## 5. 修改後驗收

> 目前 baseline 的輸出與效能是（填），修改版是（填）。請先判斷正確性是否一致，再比較總耗時、CPU 和記憶體。指出測試不足、可能的 race、buffer 越界和需要追加的邊界測資。沒有實測就不要宣稱提升。

## 6. 資訊太長怎麼辦

先貼 `tree`／`find` 結構、呼叫關係和關鍵函式，不要一次貼上幾千行。找程式時：

```bash
rg -n 'publish|subscribe|spin|pthread|engine_start|memcpy' .
sed -n '80,160p' src/main.c
```

如果 `rg` 沒有安裝，可用 `grep -R -n`。輸入過長時把問題拆成一次只解一個模組，不要讓 LLM 假裝看過未提供的檔案。
