---
id: ops-git-safe-workflow
title: Git：看變更、保留版本、誤加檔案的處理
category: 操作與除錯
tags: git,status,diff,add,commit,restore,branch
aliases: GitLab 提交,git push,staged,誤加檔案,回復版本,checkout
difficulty: beginner
priority: P0
source_type: personal
source_url: https://git-scm.com/docs/git-status
verified: false
updated_at: 2026-11-13
summary: 修改後先檢查差異，避免把錯檔案、帳密和編譯產物提交。
related: ops-gitlab-ci-oj,ncku-gitlab-workflow
---

# 最常用的安全順序

```bash
git status --short
git branch --show-current
git log -3 --oneline
git remote -v
git diff --stat
git diff --check
git diff
```

`git status --short` 的 `??` 表示尚未追蹤；若已經 `git add`，要用 `git diff --cached` 才能看到 staged 的差異。先確認分支與 remote，**不要假設 main 就是要上傳的分支**。

## 只提交知道自己改過的檔案

```bash
git add src/worker.c
git diff --cached --stat
git diff --cached
git commit -m "Fix worker synchronization"
```

`src/worker.c` 是範例路徑，要換成真實路徑。`commit` 成功只表示本機已記錄，**不表示已傳到 GitLab**。要不要 `push`，先依考場指定的 remote、branch、提交流程決定。

## 不小心 stage 了檔案

```bash
git restore --staged path/to/file
```

這會將檔案從 stage 取消（依預設還原到 HEAD 的 index 版本），**一般不會刪掉工作區的修改**。相反地 `git restore path/to/file` 會把工作區變更覆蓋，未備份不要用。更不能用 `git reset --hard` 或強制推送去試錯。

## 想留下可以回看的檢查點

已經能通過測試時，先記錄 commit ID 和測試結果。未追蹤檔案不能只靠 commit 自動保留，需確認是否應加入版本控制；也不應把帳密、金鑰放進 commit。

參考：[git status](https://git-scm.com/docs/git-status)、[git diff](https://git-scm.com/docs/git-diff)、[git restore](https://git-scm.com/docs/git-restore)。

## 延伸推演｜遇到變形題怎麼判斷

## 看清楚改動在哪，才知道能不能還原

`git diff` 看的是尚未暫存的修改；`git diff --cached` 看的是已放進 staging 的變更。`git status --short` 只顯示狀態，不能取代內容差異。假設你誤把 `secret.txt` 放進暫存區，不要因為 `git status` 顯示一個 A 就直接 Commit；先看它包含什麼。

若檔案原本有未提交的個人工作，不能隨便執行 `git reset --hard`，它會丟掉工作樹的變動。更安全的做法是先記錄現有差異、確認目標，再選擇只還原需要的檔案。遇到衝突時，先看兩邊修改內容，不要看到 `<<<<<<<` 就整段刪掉其中一側。

**練習：** 你只想讓 Codex 修 `demo_asm.c`，回來卻發現它也動了 `Dockerfile` 和 CI 腳本。第一步不是馬上 Merge，而是用 `git diff --stat` 列範圍，再核對 CI 是否被修改得不再測實際程式。
