---
id: ops-make-targets
title: GNU Make：看懂 Makefile、target 與測試指令
category: 操作與除錯
tags: make,Makefile,target,CC,CFLAGS,dry-run
aliases: make run,make test,No rule to make target,建置規則
difficulty: beginner
priority: P0
source_type: personal
source_url: https://www.gnu.org/software/make/manual/
verified: false
updated_at: 2026-11-13
summary: 先讀 Makefile 和 dry-run，避免誤執行清理、覆寫或部署目標。
related: ops-gcc-compile-link,ops-unknown-repo-first-look
---

# Makefile 的基本概念

Make 會根據規則和檔案相依關係決定需要執行什麼。`target` 是要建置或執行的目標；`make`（不帶目標）通常執行第一個預設目標，但**不保證就是編譯主程式**。

```bash
ls -la
sed -n '1,160p' Makefile
make -n
```

`make -n` 一般用來印出**預計執行**的 recipe，GNU Make 對某些特殊情況（例如遞迴 Make）有例外，不能當作完全不會執行任何命令的安全沙箱。仍須先讀過 Makefile。

## 簡短例子

```make
CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -O2
all: app

app: main.c worker.c
	$(CC) $(CFLAGS) main.c worker.c -o app -pthread

.PHONY: clean
clean:
	rm -f app
```

上面是教學例子：recipe 前面是 **Tab**，不是四個空白。執行 `make all` 建置 app，`make clean` 會刪除 `app`；**不要隨意跑 clean 或其他未知目標**。遇到 `No rule to make target`，先確認所在目錄和 target 名稱。

## 看編譯到底用了什麼

```bash
make -n all
make all
```

若 Makefile 指定 `run`、`test`，先讀 recipe，確認會不會修改資料或送網路請求，再執行。若題目由評測系統指定編譯命令，應以那一套為準，不要自行更改評測規則。

參考：[GNU Make Manual](https://www.gnu.org/software/make/manual/)、[Options Summary](https://www.gnu.org/software/make/manual/html_node/Options-Summary.html)。

## 延伸推演｜遇到變形題怎麼判斷

## 看 Makefile 時，先找到 target 和它的依賴

例如 `all: app`，而 `app: main.c engine.c engine.h`，`make` 會依規則判斷是否需要建置 app。`make run` 只有在 Makefile 定義了 `run` target 才有意義；它可能先編譯再執行，也可能只執行已存在的程式。不要把 `make` 和 `make run` 當同一件事。

編譯 C 的 pthread 程式要注意 `-pthread`，它和只寫 `-O2` 是不同目的的旗標。若改了 header 卻沒重新編譯，先檢查 Makefile 的依賴有沒有列進來，必要時使用專案既有的 clean/rebuild 指令；不要一遇錯就刪整個 repo。

**練習：** 你改了 `engine.h`，但 Makefile 只追蹤 `main.c`。`make` 可能說 `Nothing to be done`，卻還在執行舊版；這時要修正依賴規則或安全地重建，而不是懷疑 C 編譯器忽略原始碼。
