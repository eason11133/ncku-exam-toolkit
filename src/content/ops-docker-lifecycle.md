---
id: ops-docker-lifecycle
title: Docker：Image、Container、啟動與進入
category: 操作與除錯
tags: Docker,build,run,exec,logs,ps,container,image
aliases: docker 容器,container is not running,name already in use,進入容器
difficulty: beginner
priority: P0
source_type: personal
source_url: https://docs.docker.com/reference/cli/docker/container/run
verified: false
updated_at: 2026-11-13
summary: 先分清 build、run、exec、start，不在錯誤容器裡修改原始碼。
related: ops-docker-bind-mount,ncku-docker-debug
---

# 先辨認 Image 與 Container

Image 像一份環境模板；Container 是依 Image 啟動的執行個體。`docker build` 建立 Image，`docker run` **新建並啟動** Container；`docker exec` 是進入**正在執行**的 Container 內跑命令。`docker start` 可啟動已停止且未刪除的 Container。

```bash
docker --version
docker info
docker image ls
docker ps             # 正在執行
docker ps -a          # 包含已停止
```

## 一般工作流程

```bash
# 在有 Dockerfile 的目錄執行；名稱是自訂示例
docker build -t my-toolkit-image .
docker run --rm -it --name my-toolkit-session my-toolkit-image sh
```

`--rm` 表示容器退出後自動刪除，所以**不要把重要修改只留在容器檔案系統**。若有掛載原始碼目錄，寫入掛載路徑才能在主機保留。要再開一個 Shell：

```bash
docker exec -it my-toolkit-session sh
```

若回 `container is not running`：先看 `docker ps -a`。若回名字重複：看是不是已有容器，不要為了重啟直接刪掉。

## 查 Logs

```bash
docker logs --tail 100 my-toolkit-session
```

這是讀 logs，不等於 `exec` 進去，也不代表程式本身已經完成。若主程序把輸出導到檔案而非標準輸出，`docker logs` 可能看不到。

參考：[docker run](https://docs.docker.com/reference/cli/docker/container/run)、[docker exec](https://docs.docker.com/reference/cli/docker/container/exec)、[docker logs](https://docs.docker.com/reference/cli/docker/container/logs/)。
## 自己動手想一遍：為什麼關閉容器後檔案不見了？

想像你把 Demo 複製進 Image A，然後用 `docker run --rm ...` 啟動 Container 1。你在 Container 1 的 `/demo/main.c` 改了兩行，關閉終端機後想再開一次繼續。這時 `--rm` 已經把 Container 1 刪掉；下一次 `docker run` 建立的是 **Container 2**，起點仍是 Image A。除非你修改的是掛載的主機資料夾，否則那兩行不會跟著回來。

這裡有三個不同動作：

1. `docker build`：照 Dockerfile 做一份 Image。改 Dockerfile 或 `COPY` 的原始碼後，要重新 build 才會出現在新 Image。
2. `docker run`：用 Image **新開一個** Container，這和「進入原本那一個」不同。
3. `docker exec`：原 Container 還在執行時，從第二個終端機進去。如果容器已停止，`exec` 不會幫你把它啟動。

### 用不會動到原始碼的方式判斷現在在哪

```bash
pwd
ls -la
hostname
```

在主機上輸入 `docker ps`，比對 `NAMES` 和 `STATUS`。如果看到 `srecruit-demo` 是 `Up ...`，可以用 `docker exec -it srecruit-demo bash` 開第二個 Shell。若根本沒有這個容器，先確認 Image 是否存在，不要急著刪資料或重建。

### 讀懂一個常見錯誤

「`demo_asm.c: No such file or directory`」並不能直接推出 gcc 沒安裝。也可能是你在主機的專案根目錄，但檔案在 `demo/section2-2/`；或你在容器裡的 `/demo`，需要先 `cd section2-2`。先 `pwd`、`ls`，再決定是否要移動目錄。

**練習判斷：** 如果 Image 還在，Container 停止但沒有 `--rm`，應該用 `docker start` 還是 `docker run`？前者是把原容器啟動；後者會創建新的容器。這兩者不應混淆。
