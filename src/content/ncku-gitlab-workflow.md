---
id: ncku-gitlab-workflow
title: Git / GitLab 考場工作流：保留版本、檢查變更與提交
category: Git & GitLab
tags: git, GitLab, diff, commit, branch, repository
aliases: git status, git diff, git push, 提交, 版本控制
difficulty: beginner
priority: P0
source_type: personal
source_url: https://git-scm.com/docs
verified: false
updated_at: 2026-11-12
summary: 在考場保留已可運作版本、檢查修改範圍，並依指定流程提交，不預設能用 GitLab CLI。
related: ncku-performance-benchmark
---
# Git / GitLab：改得快，也要知道改了什麼

先看環境提供的 GitLab 專案和官方提交流程。不要假設 `glab` 已安裝、一定能透過網頁直接修改，或 push main 就完成繳交。

```bash
pwd
git status --short
git branch --show-current
git log -3 --oneline
git remote -v
```

修改前記錄版本；改完後：

```bash
git diff --stat
git diff
git status --short
```

確認沒有把測試檔、帳密、巨大產物、容器生成物一起加入。確定專案指定的提交方式後才執行：

```bash
git add path/to/changed_file.c
git commit -m "Fix transfer count and verify behavior"
# git push 需確認正確的 remote、branch 和考場規則
```

若 AI 建議修改，要請它列出「檔案路徑、修改原因、驗證指令」。長程式碼無法整份丟進考場 LLM，就用 `rg -n '關鍵字' .`、`sed -n '100,180p' path` 取相關段落。

## 基本排查

| 現象 | 指令 | 注意 |
|---|---|---|
| 找不到程式位置 | `rg -n 'function_name' .` | 專案沒裝 rg 可用 `grep -R -n` |
| 想看前後差異 | `git diff -- path` | 已 staged 的改動用 `git diff --cached` |
| 想還原一個尚未 stage 的檔案 | `git restore path` | **會丟掉修改**，先備份並確認 |
| 編譯失敗 | 讀完整 error | 先修第一個真實錯誤，後面可能是連鎖錯誤 |

來源：[Git reference](https://git-scm.com/docs)、[GitLab docs](https://docs.gitlab.com/topics/git/)。
