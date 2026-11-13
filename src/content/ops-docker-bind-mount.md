---
id: ops-docker-bind-mount
title: Docker Bind Mount：檔案去哪了與資料保留
category: 操作與除錯
tags: Docker,bind mount,volume,container,source,target
aliases: docker 檔案消失,掛載路徑,檔案不見,資料保留,readonly
difficulty: beginner
priority: P0
source_type: personal
source_url: https://docs.docker.com/engine/storage/bind-mounts/
verified: false
updated_at: 2026-11-13
summary: 排查本機和容器看見不同檔案、編譯結果消失、路徑被遮住。
related: ops-docker-lifecycle,ops-shell-windows
---

# 為什麼剛才修改的檔案不見了？

容器檔案系統的修改，不會自動回到本機；`--rm` 刪除容器後，未持久化的內容通常一起消失。Bind mount 把**主機既有路徑**映射到容器路徑，讓兩邊看同一份資料。

```bash
# Bash，在正確的專案資料夾執行；my-image 是示意名稱
docker run --rm -it \
  --mount "type=bind,source=$(pwd),target=/workspace" \
  my-image sh
```

進容器後確認 `pwd`、`ls /workspace`。使用 `--mount` 時，主機 source 不存在通常會報錯；用 `-v` 時，Docker 可能自動建立缺少的目錄，**反而讓你以為原檔不見了**。掛到容器已有檔案的目錄還會遮住原內容。

## 怎麼檢查實際掛載？

```bash
docker inspect my-container
```

輸出找 `Mounts` 裡的 `Source`、`Destination`、`RW`。這個指令需把 `my-container` 改成實際名稱或 ID。

## 安全修改原始碼

先在本機確認目錄與備份，再掛載。如果只是想查看，可以加 `readonly`；必須修改時才允許寫入。檔案權限也會受到容器使用者 ID 影響。若資料被遮住，先檢查 mount 設定，不要用 `rm -rf` 刪資料夾。

參考：[Docker Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)。
## 深讀延伸｜把原理放進真實情境
## 動手追一份檔案：本機修改為什麼會「消失」？

把容器想成一間有自己檔案櫃的教室。本機是另外一間。你在容器 `/demo/a.c` 改了內容，如果**沒有 bind mount**，那份修改只留在這個容器的可寫層；`docker run --rm` 結束會刪掉容器，檔案也就一起不見。`docker exec` 是進入已經開著的同一間教室；重新 `docker run` 則是開新的一間，不會繼承上次容器內的修改。

```bash
# 在主機端，先看自己在哪個目錄
pwd
ls -la
# Linux / macOS Bash 常見寫法：將目前主機目錄掛進容器
# docker run --rm -it -v "$PWD:/workspace" IMAGE_NAME bash
# 上面 IMAGE_NAME 是佔位名稱，不能直接照抄執行
```

掛載 `/workspace` 後，容器對 `/workspace/a.c` 的修改會寫到主機對應目錄；但它也會**遮住映像裡原本 `/workspace` 的檔案**。假設 Dockerfile 有 `COPY demo/ /demo/`，卻把空的主機資料夾掛到 `/demo`，容器內就可能突然找不到 Demo。這不是 Docker 刪掉檔案，而是掛載點蓋住原本視圖。

排查時先做三次確認：主機 `pwd`、容器內 `pwd`、`docker inspect` 的 Mounts。別因為 `ls` 找不到，就先 `rm -rf` 或強制重建。PowerShell 的 `$PWD` 是路徑物件，指令格式可能與 Bash 不同；看到教學包含 `$PWD:/demo`，要先確認自己用的是哪一種 Shell。

**自測問題：** 假設已開著容器 `srecruit-demo`，你要進去看檔案，應用 `docker exec -it srecruit-demo bash`，不是再 `docker run --name srecruit-demo` 建一台同名容器。
