---
id: ops-linux-paths
title: Linux：路徑、目錄、檔案與引號
category: 操作與除錯
tags: Linux,pwd,ls,cd,find,sed,head,tail,relative path
aliases: 路徑,找不到檔案,相對路徑,絕對路徑,working directory
difficulty: beginner
priority: P0
source_type: personal
source_url: https://www.gnu.org/software/coreutils/manual/
verified: false
updated_at: 2026-11-13
summary: 先知道目前位置、找得到原始碼，再修改；避免因相對路徑或空白檔名做錯。
related: ops-linux-text-search,ops-unknown-repo-first-look
---

# 看懂 Linux 路徑

`/` 是檔案系統根目錄；`.` 是目前目錄；`..` 是上一層；`~` 代表使用者家目錄。`/app/src` 是絕對路徑，`src/main.c` 是相對路徑。Linux 路徑大小寫敏感，所以 `Main.c` 與 `main.c` 可不同。

```bash
pwd                 # 現在在哪裡
ls -la              # 包括隱藏檔
cd ..               # 往上一層
cd /workspace       # 進入明確位置
find . -maxdepth 2 -type f   # 找近兩層檔案
```

`ls` 沒輸出，不一定是壞掉：可能在空目錄。`pwd` 和 `ls -la` 應該一起看。

## 先讀再改

```bash
file main.c           # 依環境判斷檔案類型；若指令不存在就跳過
sed -n '1,100p' main.c
head -n 30 README.md
tail -n 40 build.log
```

上面檔名是假設存在的例子，需換成實際檔案。對含空白的檔名，使用引號：`cat "input data.txt"`。在 Bash，`$PWD` 放在雙引號內可保留空白，寫成 `"$PWD"`；否則單字分割可能讓參數數量出錯。

## 特別注意 `>`、`>>` 與刪檔

`>` **會覆蓋檔案內容**，`>>` 是追加。`rm` 會刪檔，不會進回收桶。題目原始碼不要用重導向、批次更名或清除命令試錯。先備份或用 Git 保留可恢復版本。

參考：[GNU Coreutils manual](https://www.gnu.org/software/coreutils/manual/)、[Bash reference](https://www.gnu.org/software/bash/manual/)。

## 延伸推演｜遇到變形題怎麼判斷

## 相對路徑的意思不是「某個固定資料夾」

`./main.c` 指的是**目前工作目錄**裡的 main.c。你在 repo 根目錄和 `demo/section2-2` 下執行同樣指令，可能讀到不同檔案。`../` 是上一層，不是 Git Repo 根目錄。排查找不到檔案時，先 `pwd`，再 `ls`，最後對照 README 的起始目錄。

`/demo/section2-2` 是容器內的**絕對路徑**；主機不一定有同樣位置。PowerShell 的 `Get-Location`、Windows 的磁碟代號和 Linux `/` 目錄也不同。不要在 Windows 終端機硬貼 Linux `cd /demo` 就認為程式壞了。

**練習：** 你在 `/demo/section2-3`，要讀 `../section2-2/demo_asm.c`；若想在根目錄讀同檔則是 `section2-2/demo_asm.c`。路徑正確與否取決於當前 `pwd`，不是檔案名稱長得像不像。
