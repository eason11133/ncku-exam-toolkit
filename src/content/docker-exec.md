---
id: docker-exec-guide
title: 在容器中執行命令
category: Docker
tags: docker, container, shell
aliases: docker exec, enter container
difficulty: beginner
priority: P0
source_type: official
source_url: https://docs.docker.com/reference/cli/docker/container/exec/
verified: true
updated_at: 2026-11-09
summary: 使用 docker exec 在執行中的容器內執行命令。
related:
---

## 何時使用

需要在**執行中**的容器內檢查檔案或執行診斷命令時，使用 `docker exec`。

## 範例

```sh
docker exec -it my-container sh
```

容器映像不一定包含 `bash`。如果命令失敗，先確認容器狀態與可用的 shell。

## 官方來源

[Docker CLI reference](https://docs.docker.com/reference/cli/docker/container/exec/)
