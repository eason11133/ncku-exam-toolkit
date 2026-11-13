---
id: ops-linux-processes
title: Linux：程序、記憶體、結束碼與卡住
category: 操作與除錯
tags: ps,top,free,exit status,CPU,process
aliases: CPU 很高,CPU 很低,程式卡住,結束碼,timeout,process
difficulty: beginner
priority: P0
source_type: personal
source_url: https://www.gnu.org/software/coreutils/manual/
verified: false
updated_at: 2026-11-13
summary: 區分程式結束、卡住和真的在計算，避免把 CPU 高直接當成慢的原因。
related: ops-perf-cpu-memory,ops-perf-test-protocol
---

# 看程序是否還活著

```bash
ps -ef             # 程序列表，依環境可能不同
top                # 即時 CPU/記憶體資訊；按 q 離開
free -h            # Linux 記憶體概況
```

終端機裡直接執行程式通常會等它結束；若完全沒輸出，可能是阻塞、等待輸入、死鎖，也可能只是沒有印 log。不要直接推論。

## 程式退出後查狀態

```bash
./app
printf 'exit=%s\n' "$?"
```

`$?` 是上一個**剛執行完的指令**的結束碼，請立刻讀取；跑了其他指令就會被覆蓋。一般慣例 0 代表成功，非 0 代表異常或特殊狀態，但細節由程式決定。

## 中止程式前的判斷

`Ctrl+C` 會向前景程序送出中斷訊號，不代表程式一定會立即安全關閉。不要在正式測試中隨意 kill 會寫入結果的程序。`timeout 5s ./app` 是 GNU coreutils 常見指令，**限你已確認程序可以被中斷的情境**。

## CPU 與 Wall Time

CPU 使用率高，可能正在做有效工作，也可能是忙等；CPU 使用率低，可能在等 I/O、鎖或排程。要記下總耗時（wall time）、輸入大小、輸出正確性，再對照 CPU 與記憶體。單看 `top` 不能知道哪行慢。

參考：[GNU Coreutils](https://www.gnu.org/software/coreutils/manual/)、[Python `perf_counter`](https://docs.python.org/3/library/time.html#time.perf_counter)。
## 深讀延伸｜把原理放進真實情境
## 程式「沒有輸出」至少有四種可能

第一種是**等輸入**：程式正在 `scanf` / `fgets`，你沒送資料。第二種是**正在計算**：CPU 使用率高，但未必死循環。第三種是**等待鎖或 I/O**：CPU 可能很低。第四種是**已經退出**：你只是沒注意到錯誤訊息寫在 `stderr`。

在另一個 Terminal 看 `ps` 或容器內的 process 清單，只能知道程序狀態，不能直接猜出全部原因：

```bash
ps -ef
# 看退出碼要在「原本執行程式」的 Shell 中、下一行立刻執行
# ./program < sample.txt
# echo $?
```

`echo $?` 是「**上一個 Shell 指令**」的退出碼；若你先執行 `ls` 再看 `$?`，看到的是 `ls`，不是程式。`./program sample.txt` 是把檔名當**命令列參數**傳給程式；`./program < sample.txt` 才是把檔案內容接到**標準輸入**。這兩種方式不能互換，得看 `main(int argc, char **argv)` 或讀取程式碼決定。

如果是 pthread 程式沒輸出，不要先加更多執行緒。看它是卡在 `join`、`mutex_lock`、`cond_wait`，還是其實正在等待輸入。中斷前先確認原程式有沒有需要保留的工作或檔案；不要把 `kill -9` 當第一個排錯步驟。
