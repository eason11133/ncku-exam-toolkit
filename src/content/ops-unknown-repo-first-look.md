---
id: ops-unknown-repo-first-look
title: 陌生專案拿到後的前 10 分鐘：先讀哪裡
category: 操作與除錯
tags: 陌生專案,README,main,入口,Makefile,baseline
aliases: 看不懂專案,讀原始碼,專案架構,先做什麼,找主程式
difficulty: beginner
priority: P0
source_type: personal
source_url: https://git-scm.com/docs/git-status
verified: false
updated_at: 2026-11-13
summary: 從 README、Build 設定和程式入口定位工作，不要一開始就重構。
related: ops-linux-text-search,ops-perf-test-protocol
---

# 先搞懂「怎麼跑」與「什麼算對」

不要看到陌生程式就開始優化。先確認題目要求、輸入輸出、執行命令、測試方式，以及會不會有硬體／網路限制。

```bash
pwd
ls -la
find . -maxdepth 2 -type f | head -n 80
git status --short
```

常見專案入口：`README.md`、`Makefile`、`CMakeLists.txt`、`pyproject.toml`、`requirements.txt`、`package.json`、`Dockerfile`、`src/`、`tests/`。看到這些檔案只能判斷可能使用的工具，**不能因此假設指令已安裝或正確**。

## 查呼叫鏈

假設主程序從 `main` 開始：

```bash
rg -n '\bmain\s*\(' .
rg -n 'worker|callback|run' src
```

若沒有 `rg`，可以換 `grep -R -n`。查到函式後，確認誰呼叫它、參數與回傳值、資料在何處改動。C/C++ 的 `main()` 可能不在主要計算模組；Python 也可能由 CLI Entry Point 進入。

## 建 Baseline

1. 在任何修改之前跑原本的測試，留存指令與錯誤。
2. 確認輸出與題意一致。原始程式也可能有缺陷，不能把原結果當絕對真值。
3. 保存執行時間、CPU／記憶體觀測與 Git 版本，之後才能比。

## 交給 LLM 要它做的事

只要求它從你貼的檔案分析「入口、模組關係、需要哪段程式、如何驗證」。**禁止它在缺少原始碼時編造 API**。每次只改一種假設並測試；若更快但答案錯，就回退。

參考：[Git status](https://git-scm.com/docs/git-status)、[GNU Make](https://www.gnu.org/software/make/manual/)。

## 延伸推演｜遇到變形題怎麼判斷

## 用一個陌生 Repo 練「先看什麼」

你在考場拿到專案，根目錄只有 `demo/`、`README.md`、`Makefile`、`src/`。先別急著把全部檔案打開。讀 README 確認題目給的入口和完成條件，再看 Makefile 的 `all`、`run`、`test` 到底做什麼；最後找 `main` 或指定的 Demo 檔案。**專案有 Makefile 不代表 `make` 會執行程式**：它可能只負責編譯。

一個實際順序可以是：`pwd` → `ls -la` → `find . -maxdepth 2 -type f` → `sed -n '1,120p' README.md` → `make help`（只有確定有 help target 才執行）→ `git status --short`。如果 repo 有 `.gitlab-ci.yml`，再讀它，看哪些命令會在提交後被跑，不能自動認為本機 Build 完就會被採計。

**變形：** 如果 `README` 說 `docker build -t srecruit-demo demo/`，你人在 `demo/` 裡還照抄，同樣的相對路徑可能找錯。每條指令都要先知道「預設在哪個目錄執行」。
