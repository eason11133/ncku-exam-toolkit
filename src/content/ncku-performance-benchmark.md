---
id: ncku-performance-benchmark
title: 效能優化前後：如何量測、比較、避免誤判
category: Performance Engineering
tags: benchmark, latency, throughput, memory, CPU, perf, correctness
aliases: 基準測試, p95, memory usage, 效能分析, profiling
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-12
summary: 用同樣輸入、正確性測試及多次量測比較修改前後的時間、CPU 與記憶體。
related: ncku-ros2-executor, ncku-pthread-critical-section, ncku-transfer-engine
---
# 效能測試：先確保能正確完成

一次成功不等於可靠，一次變快也不代表真的優化。比較時遵守：**先通過正確性，再固定測試條件，再測多次。**

## 開始修改前保留基準

```bash
git status --short
git diff
git rev-parse HEAD
# 使用既有專案測試指令，不要假設每個專案都是 make test
```

盡量保留同一份輸入資料、相同背景負載和執行硬體，記錄 `n`、輸入特性與測試版本。建議記錄每次結果，至少看中位數與慢尾（例如 p95）；樣本很少時不要把 p95 當成穩定指標。

## 基本量測方法

Python：

```python
from time import perf_counter

t0 = perf_counter()
result = solve(data)
dt_ms = (perf_counter() - t0) * 1000
print(f'{dt_ms:.3f} ms')
```

C/POSIX：

```c
#define _POSIX_C_SOURCE 199309L /* glibc/POSIX 嚴格 C11：須在系統標頭之前 */
#include <time.h>

struct timespec t0, t1;
if (clock_gettime(CLOCK_MONOTONIC, &t0) != 0) { /* 處理計時失敗 */ }
/* run_workload(); */
if (clock_gettime(CLOCK_MONOTONIC, &t1) != 0) { /* 處理計時失敗 */ }
double ms = (t1.tv_sec - t0.tv_sec) * 1000.0
          + (t1.tv_nsec - t0.tv_nsec) / 1000000.0;
```

這些是 wall-clock 經過時間，不等於 CPU 使用率。工具可用時再補 `time -v`（GNU time，使用 `-v` 的可用性依環境）、`/usr/bin/time`、`top`、`ps`、`perf stat`（可能因權限無法使用）。

## 指標彼此可能衝突

| 指標 | 看什麼 | 常見誤判 |
|---|---|---|
| 總耗時 | 輸入到結果完成 | 單次快可能只是系統抖動 |
| p50 / p95 | 一般與慢尾請求 | 樣本數太少不穩定 |
| Throughput | 每秒處理幾筆 | 吞吐高不代表每筆延遲低 |
| CPU | 使用的 CPU 時間／核心 | 忙等 spinlock 可能「快」但 CPU 高 |
| RSS / peak memory | 記憶體占用 | 複製資料可能換取速度但大幅增記憶體 |
| 正確性 | 結果值、順序、數量 | 掉訊息、跳過工作也能讓程式看似變快 |

## 最小比較表

| 版本 | 正確性 | 時間 ms（中位數） | p95 ms | CPU | 記憶體 | 註記 |
|---|---|---:|---:|---|---|---|
| baseline | pass / fail | 待量測 | 待量測 | 待量測 | 待量測 | 原始版本 |
| modified | pass / fail | 待量測 | 待量測 | 待量測 | 待量測 | 具體改動 |

沒有測量就保留「待量測」，不可把理論估計寫成實驗數據。

## 怎麼排優化方向

先辨別 CPU-bound、I/O-bound、Lock-bound、Memory-bandwidth-bound，並且用剖析（profiling）或基本計時支持判斷。再挑改動小、容易回退、可重複驗證的方案。能跑的 baseline 應保留；改一項就測一次，不能同時改很多項後猜是哪個有效。

來源：[Python time](https://docs.python.org/3/library/time.html)、[GNU time](https://www.gnu.org/software/time/)、[Linux perf](https://perf.wiki.kernel.org/index.php/Main_Page)。
