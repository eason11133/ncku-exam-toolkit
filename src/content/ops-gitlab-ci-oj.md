---
id: ops-gitlab-ci-oj
title: GitLab 試前測試：登入、Clone、Pipeline、OJ 的差別
category: 操作與除錯
tags: GitLab,OJ,pipeline,CI,clone,commit,push
aliases: 試前測試,GitLab 登入,評測,交卷,CI Job,提交
difficulty: beginner
priority: P0
source_type: personal
source_url: https://docs.gitlab.com/topics/git/clone/
verified: false
updated_at: 2026-11-13
summary: 把 GitLab 交付與 Online Judge 評分分開，按實際考場說明操作。
related: ops-git-safe-workflow,ops-gitlab-final-check
---

# 先分清五件事

- **GitLab 專案**：存放程式碼與版本紀錄。
- **Commit**：把版本記在本機 Git 歷史。
- **Push**：把本機提交傳到遠端 GitLab 分支。
- **CI/CD Pipeline**：若專案設定了 `.gitlab-ci.yml` 且可用 runner，符合觸發條件時才會跑 Job。
- **OJ（Online Judge）**：由主辦方提供的評測介面／系統，不一定與 GitLab Pipeline 相同，也**不能假設 GitLab 試前測試就會開放 OJ**。

## 第一次登入後

1. 依官方郵件提供的 GitLab 網址登入。確認帳號能看到被指定的專案。
2. 看 README、分支、提交與測試說明；別直接修改預設分支。
3. 若允許 Clone，從 GitLab 的 Code 按鈕複製 **實際** Clone URL。
4. 選對資料夾後執行：

```bash
git clone ACTUAL_CLONE_URL
cd ACTUAL_PROJECT_DIRECTORY
git status --short
git remote -v
git branch --show-current
```

上面兩個大寫字是**佔位符**，不能照字面執行。HTTPS 有雙重驗證時，通常不能用一般帳號密碼直接做 Git 操作，可能要用 Token 或登入輔助工具；不要把 Token 貼到聊天室或公開記錄。

## 試前測試應確認

- 指定哪個 repository／branch 與哪個提交方式？
- 修改後需 `push`，還是用網頁交檔／另一套提交按鈕？
- 有沒有 Pipeline？可在哪裡看到 Job log？
- OJ 是否另有入口、編譯與評分方式、是否開放測試？

若 Pipeline 失敗，進入該 Pipeline 的失敗 Job 讀完整 log，找**第一個真正錯誤**。若沒有 Pipeline，不能把它當成考場評分壞掉。

參考：[GitLab Clone](https://docs.gitlab.com/topics/git/clone/)、[Pipelines](https://docs.gitlab.com/ci/pipelines/)、[Jobs](https://docs.gitlab.com/ci/jobs/)。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 一個最容易讓人誤判的例子

你在 GitLab 網頁看到程式碼了，並不代表考場的評測器已經拿到最新版：可能尚未 Commit、Commit 只在本機未 Push、Push 到錯分支，或考場根本採另一個交卷入口。

先核對 `git status --short`、`git branch --show-current`、`git log -1 --oneline`、`git remote -v`。如果 GitLab 有 Pipeline，再查看對應 Commit 的 Job；**沒有 Pipeline、沒有 Runner、或沒有 Test Job** 不能寫成「測試全過」。

### 交卷前最小驗收順序

1. 確認官方要求的檔案與提交入口。
2. 本地先能重新編譯、執行固定測資。
3. 用 `git diff` 和 `git diff --staged` 看是否還有沒提交的變更。
4. 若規定 Push，確認遠端分支及最後 Commit 與本地一致。
5. 若有 OJ，依官方要求提交並讀回覆；GitLab Pipeline PASS 不能替代 OJ Hidden Tests。

這些是一般 GitLab 操作概念，不代表考場一定會開放 OJ、一定要求 Push 或使用特定 Pipeline。要以正式考場說明為準。
## 一次 Push 到 GitLab，實際上發生了哪些事？

你把程式改好了，先 `git status` 看哪些檔案修改，再 `git diff` 看還沒暫存的改動。`git add` 是選擇本次要記錄的版本；`git commit` 是在本機留下版本；**`git push` 才是把版本送到遠端**。如果系統有 CI Pipeline，Push 之後可能觸發測試，但「可能」不等於每個 GitLab 專案都配置了自動評測。

```bash
git status --short
git diff -- main.c
git add main.c
git diff --staged
git commit -m "Fix transfer count unit"
git push
```

上面的指令是**示意提交流程**，實際檔名、分支、網路和認證要以考場規則為準。若已存在其他人的修改，不要用 `git reset --hard` 清掉；也不要為了把 Pipeline 變綠而改掉不該動的測試。

### 三種「看起來成功」，意思完全不同

- `git push` 成功：遠端收到了這次提交。
- Pipeline 顯示綠色：**專案設定會執行的** Jobs 通過；可能只做 Build，也可能包含測試。
- 題目獲得分數：取決於考場實際評測系統和隱藏資料。不能從前兩種直接推論第三種。

假設你提交後看到 `Pipeline Passed`，但程式把 `count` 誤填成 `N*sizeof(uint32_t)`；若 CI 沒測 count 單位，仍可能顯示 Passed。你需要自己用小測資、邊界資料和官方 Demo 的預期結果驗證。

考場若只允許特定分支或指定路徑提交，這些規定優先。先看明確公告，不能把 GitLab 的一般用法當成考試交件規則。
