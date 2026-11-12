---
id: ncku-compiler-profile-sanitize
title: GCC、Sanitizer 與 perf：先找瓶頸再比較最佳化
category: Debugging
tags: gcc, compiler, O2, O3, sanitizer, AddressSanitizer, UndefinedBehaviorSanitizer, perf
aliases: 編譯器最佳化, 編譯旗標, 效能分析, sanitizer, CPU profiling, 測速
source_type: personal
source_url: https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html
verified: false
updated_at: 2026-11-12
summary: 先建立可重複的測試，再把正確性檢查與效能量測分開，避免不小心用不同條件比較。
related: ncku-performance-benchmark, ncku-c-memory, ncku-debug-decision-tree
priority: P0
difficulty: intermediate
---

# 程式慢，先不要直接把編譯選項換成 `-O3`

## 先問：慢在哪個階段？

同一份程式可能花時間在編譯、啟動、處理資料、等待 I/O 或記憶體分配。正式評分可能看整體完成時間，不能只測其中一個函式、再宣稱總時間改善。

在 Linux 上先用簡單、可用的工具收集 Baseline：

```bash
/usr/bin/time -v ./program input.txt
```

如果 `/usr/bin/time` 未安裝，可先用 shell 的 `time`，但兩者輸出與指標不同。

若考場允許且系統有安裝 `perf`：

```bash
perf stat -- ./program input.txt
```

`perf` 可收集 CPU cycles、instructions 等事件，但能否使用取決於 kernel、權限、硬體。出現 `Permission denied` 或沒有事件時，**不要擅自改考場系統設定**；退回 `/usr/bin/time`、程式內分段計時。

## 方案 A：`-O0`、`-O2`、`-O3` 不是愈大一定愈好

```bash
gcc -std=c11 -O0 -g main.c -o prog_o0
gcc -std=c11 -O2 -g main.c -o prog_o2
gcc -std=c11 -O3 -g main.c -o prog_o3
```

`-O0` 適合除錯觀察；`-O2` 開啟大量一般最佳化；`-O3` 再做更積極的最佳化。`-O3` 可能增加可執行檔大小，也可能對特定負載沒有改善甚至更慢，所以要對照同一組輸入測試。

比較時記錄編譯器版本、架構、指令、輸入及重複次數。修改前後一定要先通過相同正確性測試。

## 方案 B：先用 Sanitizer 把危險錯誤找出來

```bash
gcc -std=c11 -O1 -g -fno-omit-frame-pointer \
  -fsanitize=address,undefined main.c -o prog_check
./prog_check
```

AddressSanitizer 可協助找越界與 use-after-free；UndefinedBehaviorSanitizer 可檢查多種未定義行為（例如不合法的 shift）。這是**除錯版**，Sanitizer 會增加執行成本，不適合直接拿它與普通 Release 版比較效能。

若要查多執行緒的 data race，可考慮 ThreadSanitizer（TSan），**它不能與 AddressSanitizer 同時啟用**：

```bash
gcc -std=c11 -O1 -g -pthread -fsanitize=thread thread_demo.c -o thread_check
```

TSan 的支援和實際執行狀況依平台而異；它也不是所有競爭條件的完整證明。請先用程式的邏輯、鎖和生命週期檢查。

## 方案 C：分段計時與 Profiling，區分耗時與「卡住」

如果一個處理流程包含 `read → parse → calculate → write`，先在每段前後打點；如果慢在 `read()` 等待資料，就算換演算法也不一定有幫助。

C 的簡易例子：

```c
#include <time.h>

struct timespec start, end;
clock_gettime(CLOCK_MONOTONIC, &start);
/* 呼叫想量的函式 */
clock_gettime(CLOCK_MONOTONIC, &end);
double ms = (end.tv_sec - start.tv_sec) * 1000.0 +
            (end.tv_nsec - start.tv_nsec) / 1e6;
```

此段以 POSIX/Linux 為前提，某些編譯環境需要設定 feature test macro。不要在每筆極短操作都寫大量日誌，因為 Logging 本身可能改變量測結果。

## 考場判讀順序

先固定編譯旗標與輸入，找出慢的階段；再做**單一、可還原**的程式修改。每次修改後做：正確性 → 基準測試 → CPU／記憶體／延遲 → 保留或還原。

請不要用一次最快值代表改善。應比較多次的中位數或分布，並標記是否同時有其他工作在使用 CPU。

**查證狀態**：指令與工具用途依 GCC、perf 官方文件；沒有宣稱特定優化旗標在考場機器上測得加速。

來源：[GCC optimize options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html)、[GCC instrumentation options](https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html)、[perf stat](https://man7.org/linux/man-pages/man1/perf-stat.1.html)。
