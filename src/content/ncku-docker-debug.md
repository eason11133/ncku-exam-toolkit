---
id: ncku-docker-debug
title: Docker、Linux 終端機與上機考開發環境
category: Docker
tags: Docker, Linux, gcc, make, bind mount, shell, container
aliases: docker exec, WSL, build, run, 安裝環境
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.docker.com/reference/cli/docker/container/run/
verified: false
updated_at: 2026-11-12
summary: 在不破壞資料的前提下操作官方 Demo 容器、額外終端機與本地修改。
related: ncku-ros2-cli-workflow
---
# Docker 與 Linux：可直接查的操作

## Docker 的三件事

- **Image**：建立好的環境模板，包括 ROS 2、gcc、make 等依賴。
- **Container**：由 Image 啟動的執行環境；`--rm` 會在停止後刪除它。
- **Bind mount**：把本機資料夾映射到 Container，修改才會在本機留著。

官方示範在 `demo/` 目錄執行：

```bash
docker build -t srecruit-demo .
docker run --rm -it --name srecruit-demo -v "$PWD:/demo" srecruit-demo
```

`-v "$PWD:/demo"` 把現在的資料夾掛到容器 `/demo`。確定所在資料夾就是 `demo/`；若路徑錯了，可能遮住容器本來的示範檔案。

第二個終端機要進入**同一個已啟動容器**：

```bash
docker exec -it srecruit-demo bash
```

如果容器沒有 `bash`，可視情況換 `sh`。不能用 `docker exec` 啟動尚未執行的容器；先看 `docker ps -a`。

## 遇錯的第一步

| 錯誤 | 先檢查 |
|---|---|
| `container is not running` | `docker ps -a`，確認名字與狀態 |
| `name already in use` | 不要再 run 同名容器，改用 `docker exec`；必要時再確認能否刪除 |
| 找不到檔案 | `pwd`、`ls -la`、目前的 bind mount |
| `permission denied` | 檔案權限、Docker daemon、WSL 權限設定 |
| `ros2: command not found` | `which ros2`、ROS 環境是否已 source |
| gcc 連結 pthread 失敗 | 是否使用專案原有 Makefile、`-pthread` |

## 原始碼修改前的最小檢查

```bash
pwd
ls -la
find . -maxdepth 2 -type f | head -60
git status --short
```

不要在不了解的專案中先 `rm -rf`、`git reset --hard`、強制覆蓋設定，因為可能刪除考試已完成的成果。已通過測試的版本要能回退。

## 官方練習對應

```bash
cd /demo/section2-2
cc demo_asm.c -o demo_asm && ./demo_asm
cd /demo/section2-3
make run
```

來源：[Docker run](https://docs.docker.com/reference/cli/docker/container/run/)、[Docker exec](https://docs.docker.com/reference/cli/docker/container/exec/)。
