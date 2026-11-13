---
id: ops-gitlab-final-check
title: GitLab 最後交付前：版本、遠端與證據
category: 操作與除錯
tags: GitLab,submit,pipeline,commit,CI,checklist
aliases: 最後提交,交卷前,上傳確認,Git SHA,OJ 結果
difficulty: beginner
priority: P0
source_type: personal
source_url: https://docs.gitlab.com/ci/pipelines/
verified: false
updated_at: 2026-11-13
summary: 只依主辦方規則交付，分辨 commit、push、pipeline 與獨立 OJ。
related: ops-gitlab-ci-oj,ops-git-safe-workflow
---

# 交付前先停止大改

先確認題目規定的正確輸入輸出、建置與執行流程。最後一次修改後要重跑測試；不要因為趕時間直接上傳未測的版本。

```bash
git status --short
git branch --show-current
git log -1 --oneline
git remote -v
git diff --stat
git diff --cached --stat
```

如果要依規定提交，先確認指定 branch、是否允許新增檔案、是否用 Push 或獨立評測系統。`git log` 只證明本機有 Commit，**不能證明已推送**；畫面上有 GitLab Commit 也不能證明 OJ 接收完成。

## Pipeline 狀態

若 GitLab 有 CI/CD，看到 Pipeline Success，僅代表**那些 Job 定義的檢查**成功，可能只建置、沒有跑全部隱藏測資。若 Jobs 還在 pending，不要自稱已驗收。若主辦方要求 OJ 提交，請以 OJ 真正回報的狀態判斷。

## 可保留的最後證據

- 使用哪個 repository、branch、commit SHA。
- 哪個測試命令執行成功，以及時間。
- Pipeline／OJ 的實際狀態與結果（若有）。
- 尚未驗證的特殊輸入、硬體行為或效能指標。

不要把密碼、token、機密檔案一起記錄。考場若另有官方規則，優先遵守規則。

參考：[GitLab Pipelines](https://docs.gitlab.com/ci/pipelines/)、[GitLab Jobs](https://docs.gitlab.com/ci/jobs/)。
## 深讀延伸｜把原理放進真實情境
## Commit、Push、Pipeline、OJ 是四個不同的關卡

假設你在電腦上改好 `main.c`，輸入 `git commit` 得到一個 SHA。這只證明**本機**有這筆版本，不代表 GitLab 收到了。`git push` 成功後，還要看遠端分支是否包含這個 SHA。若題目還要求 Pipeline 或獨立 Online Judge，兩者各自有評分規則，不能拿「GitLab 上看到檔案」代替測試通過。

```bash
git status --short
git log -1 --oneline
git branch --show-current
git remote -v
# 需要連網且考場允許，才檢查遠端最新記錄
# git ls-remote --heads origin
```

`git status` 乾淨也**不一定表示**已 Push；它只是工作樹與索引相對於目前 commit 沒有未提交變動。先記下最後 commit，再透過 GitLab 網頁或允許的遠端查詢確認。Pipeline 綠燈說明「該 Pipeline 設定的工作通過」，**不等於測試一定完整**；你要確認測試工作是否真的有編譯、執行、比對答案。

一個常見踩雷情境是最後五分鐘把 `Makefile` 改好，卻 Push 到另一個 branch，Pipeline 在舊 branch 通過。交付前應確認 branch、commit SHA、遠端狀態和主辦方指定的提交方式。**別在不了解狀況時 `git push --force`**；它可能改寫遠端已有的工作。
