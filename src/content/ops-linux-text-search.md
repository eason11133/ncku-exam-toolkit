---
id: ops-linux-text-search
title: Linux：搜尋程式碼、管線與輸出
category: 操作與除錯
tags: grep,rg,sed,find,pipe,stdout,stderr
aliases: 搜尋函式,行號,程式碼查找,Log 過濾,LLM 太長
difficulty: beginner
priority: P0
source_type: personal
source_url: https://www.gnu.org/software/grep/manual/
verified: false
updated_at: 2026-11-13
summary: 用 grep、find、sed 缩小要貼給 LLM 的程式碼，避免整包貼不下。
related: ops-unknown-repo-first-look,ops-llm-stepwise-guide
---

# 先定位問題，不要把整個專案丟給 LLM

假設要找 `engine_claim` 在哪裡定義與呼叫：

```bash
# rg 若有安裝，速度與忽略規則通常更方便
rg -n 'engine_claim' .
# 沒有 rg 時：
grep -R -n 'engine_claim' . --include='*.c' --include='*.h'
```

搜尋結果像 `src/engine.c:42:...`，代表檔案與行號。Linux 的 `grep` 常見返回碼：找到是 0、沒找到是 1、搜尋本身發生錯誤可能是 2。**沒找到不是程式壞掉**。

## 把大檔切成小段

```bash
sed -n '35,85p' src/engine.c
find . -type f -name '*.h'
git grep -n 'engine_job_t'   # 只有 Git 追蹤的檔案；需在 Git 專案內
```

`|` 管線把上一個指令的標準輸出傳給下一個。例如：

```bash
find . -type f | head -n 30
```

這只顯示前 30 行，**並不表示專案只有 30 個檔案**。

## 標準輸出與錯誤輸出不同

`program > out.txt 2> err.txt`：正常輸出寫入 `out.txt`，錯誤訊息寫入 `err.txt`。用 `2>&1` 可以合併兩種輸出，但若檔案已有內容，先確認你不會覆蓋重要紀錄。

## 交給 LLM 的最小資訊

貼：題目要求、實際錯誤、相關函式前後的程式碼、你跑的命令、預期與實際輸出。若內容不完整，要求 LLM 指出「還需要哪一段」，不要讓它猜不存在的 API。

參考：[GNU Grep manual](https://www.gnu.org/software/grep/manual/)、[Git grep](https://git-scm.com/docs/git-grep)。

## 延伸推演｜遇到變形題怎麼判斷

## 找到檔名不等於找到程式真正執行的位置

假設你搜尋 `counter`，結果同時出現在 README、註解、測試檔和真正的 worker 裡。先縮小範圍，例如 `grep -Rni --exclude-dir=.git 'counter' src demo`。找到定義後，再找呼叫者及更新位置；**變數有宣告**不代表在多執行緒下每次存取都有鎖。

`grep` 印的是「包含字串的行」，不是語法分析器。搜尋 `push` 也可能找到普通文字的 `push` 或 `git push`，不能直接當作 PIO 指令。若輸出太多，先從 README、Makefile 找到執行的程式，再查其依賴。含有空白的檔案路徑記得加引號，例如 `grep -n 'count' 'my folder/main.c'`。

**自測：** `grep -R` 找到 `src/old/main.c` 裡的 Bug，但目前 Makefile 編的是 `src/new/main.c`。若你只修 old，為什麼執行結果沒改？因為編譯的檔案清單才決定哪份程式被用到。
