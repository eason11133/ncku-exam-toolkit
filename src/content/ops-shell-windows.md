---
id: ops-shell-windows
title: Windows CMD、PowerShell、Linux Bash 怎麼分
category: 操作與除錯
tags: CMD,PowerShell,Bash,Windows,WSL,terminal
aliases: 命令提示字元,終端機,ps,cmd,Shell 不同,本機路徑
difficulty: beginner
priority: P0
source_type: personal
source_url: https://learn.microsoft.com/powershell/
verified: false
updated_at: 2026-11-13
summary: 同樣是終端機，變數、路徑和切換目錄的寫法可能不同。
related: ops-linux-paths,ops-docker-bind-mount
---

# 先看你開的是哪一種終端機

CMD 常顯示 `C:\Users\...>`，PowerShell 常顯示 `PS C:\...>`，Linux Bash 常顯示 `user@host:~$`。Windows Terminal 是視窗程式，**不是一種 Shell**；它可以開 CMD、PowerShell 或 WSL。你之前已經用 CMD 操作過 Docker，不必從零學，但別把三種語法混在一起。

| 想做什麼 | CMD | PowerShell | Linux Bash |
|---|---|---|---|
| 目前目錄 | `cd` | `Get-Location` 或 `pwd` | `pwd` |
| 列出檔案 | `dir` | `Get-ChildItem` 或 `ls` | `ls -la` |
| 顯示變數 | `echo %CD%` | `$PWD.Path` | `echo "$PWD"` |
| 搜尋字串 | `findstr /n /i "ERROR" log.txt` | `Select-String -Path log.txt -Pattern ERROR` | `grep -n 'ERROR' log.txt` |
| 看檔案 | `type log.txt` | `Get-Content log.txt` | `cat log.txt` |

**先確定自己在哪裡**，再照教學複製指令。尤其 `&&`：CMD、Bash 可用來條件串接；舊版 Windows PowerShell 5.1 不支援這個運算子，PowerShell 7 才支援。遇到語法錯誤，先把每行拆開執行。

## Docker 掛載路徑別照抄

下面示範將目前的資料夾掛到 Linux Container 的 `/workspace`，三種 Shell 的「取得目前路徑」方式不同。先用 `pwd`／`cd` 確認資料夾正確。

```powershell
# PowerShell：避免 $PWD 與冒號被誤解，使用 --mount 格式
docker run --rm -it --mount "type=bind,source=$($PWD.Path),target=/workspace" IMAGE_NAME sh
```

```bash
# Bash（Linux／WSL）
docker run --rm -it --mount "type=bind,source=$(pwd),target=/workspace" IMAGE_NAME sh
```

`IMAGE_NAME` 要換成實際映像名稱；以上是**操作模板，不是可直接執行的完整指令**。Windows Docker Desktop 的 Linux 容器與 WSL 路徑設定也可能影響結果。不能在沒有確認掛載路徑時寫入檔案。

## 如果指令失敗

先記錄：你正在使用的 Shell、所在路徑、原指令、完整錯誤。`command not found`／`not recognized` 要先查程式是否安裝和 PATH，不要立刻重灌。

參考：[Microsoft PowerShell](https://learn.microsoft.com/powershell/)、[Docker Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)。
