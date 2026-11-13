---
id: ops-code-change-audit
title: AI 修改程式前後的核對清單
category: 操作與除錯
tags: code review,git diff,AI,regression,test
aliases: AI 改壞,修改審查,程式碼差異,回歸測試,patch
difficulty: beginner
priority: P0
source_type: personal
source_url: https://git-scm.com/docs/git-diff
verified: false
updated_at: 2026-11-13
summary: 限制 AI 改動範圍，保住原始正確版本和評測行為。
related: ops-perf-test-protocol,ops-git-safe-workflow
---

# 不要把 AI 給的程式直接整包貼上

先要求它列出：改哪個檔案、哪個函式、為什麼改、預期改善什麼、哪些輸入可能受影響、如何測試。有條件時優先小範圍差異（diff），不要整份重寫。

## 實際檢查

```bash
git status --short
git diff --stat
git diff --check
git diff
```

檢查它有沒有順手修改輸入輸出格式、刪除測試、改動錯誤處理、降低資料量、移除同步或添加環境不存在的函式。尤其 C 語言要核對 Header 與原始函式原型，不能看到相似 API 就照抄。

## 要保留的證據

```text
測試命令：＿＿＿
基準版 commit：＿＿＿
變更版 commit：＿＿＿
相同輸入與輸出是否一致：＿＿＿
多次測試數據與量測條件：＿＿＿
還沒檢查的假設：＿＿＿
```

## 須拒絕的『優化』

- 假設資料永遠有效，刪掉邊界檢查但沒有題目保證。
- 把同步拿掉造成 data race，再用較低耗時說成功。
- 把大量訊息丟掉，然後只報延遲下降。
- 更換演算法卻沒有證明輸出與原定義相容。

如果已經出錯，先靠小測資找回正確行為，不要把多個修改混在一起一起 debug。

參考：[Git diff](https://git-scm.com/docs/git-diff)、[GCC warnings](https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html)。
## 深讀延伸｜把原理放進真實情境
## 一次 AI 改動到底怎麼驗收？用三個檔案當例子

假設原來 `main.c` 會讀 `stdin`，你請 AI「把輸入解析加速」，它卻順手把 `README.md`、`Makefile` 都改掉。**先不要看它說快了幾倍**：先用 `git diff --stat` 看碰到哪些檔案，再用 `git diff -- main.c Makefile` 看每行差異。沒有測量前，AI 說的提升只是猜想。

```bash
# 只在正確的 repo 根目錄執行
pwd
git status --short
git diff --stat
git diff --check
# 已加入暫存區的變更，另用 --cached 看
git diff --cached --stat
```

`git status --short` 只告訴你哪些檔案有變，**不是**修改的內容；`git diff` 預設不會顯示已暫存的部分。兩個都看才能知道是否還有隱藏改動。先看 `Makefile` 中原本使用 `-pthread` 的地方有沒有被弄掉；再看 `main.c` 中原本處理空輸入、錯誤輸入的分支是否仍在。

測試順序要反過來想：先比「同一份測資下輸出是否相同」，再比時間。若程式原來算 10,000 筆，新版只算 9,900 筆，即使快 10 倍也不能通過。盡量保留可重現的輸入、完整指令、退出碼與輸出檔。考場如有提交規定，以主辦方要求為準；不要把額外測試檔直接當正式交付內容。

**練習判斷：** AI 宣稱 `npm run build` 通過，但它把測試改成永遠回傳成功。你應該先檢查哪個檔案？答案是測試／建置腳本本身，因為「指令退出碼為 0」必須搭配可信的驗收內容。
