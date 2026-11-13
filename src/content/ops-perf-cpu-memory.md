---
id: ops-perf-cpu-memory
title: 效能量測：Wall Time、CPU Time、記憶體與吞吐
category: 操作與除錯
tags: wall time,CPU time,RSS,memory,benchmark,perf_counter
aliases: CPU 使用率,效能測試,記憶體峰值,耗時,吞吐,performance
difficulty: beginner
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-13
summary: 分清完成時間、CPU 使用率、記憶體峰值，量測時必須保留正確性。
related: ops-perf-test-protocol,ncku-performance-benchmark
---

# 別把「CPU 低」直接當「程式比較快」

Wall time 是開始到完成的實際經過時間，包含等待；CPU time 是執行緒／程序花在 CPU 的時間，二者不是同一種量。多執行緒或多程序的 CPU time 與 wall time 也不能隨意比較。記憶體總用量、峰值 RSS 與程式配置量各有差異。

## Linux 命令（有這些工具才使用）

```bash
time -p ./app
/usr/bin/time -v ./app
```

`time -p` 可能是 Shell 的 built-in 或外部程式；`/usr/bin/time -v` 是常見 GNU time 功能，環境不一定安裝。**不要只拿單次結果說加速了**。

## Python 時間範例（可執行）

```python
import time

def work():
    return sum(i * i for i in range(10000))

start = time.perf_counter()
answer = work()
wall_seconds = time.perf_counter() - start
print(answer, wall_seconds)
```

`perf_counter()` 適合量 elapsed time，包含 sleep；`process_time()` 回傳目前程序使用的 CPU time，不包含 sleep。只有兩次讀值相減才有比較意義，回傳的數值本身不是時間戳。

## 做比較時至少記錄

同一輸入、輸出正確、同一環境、同一建置旗標（除了正在比較的設定）、數次重跑的分布。不要把不同資料量或忽略檢查的結果放在一張比較表；要同時看極端慢的情況和失敗率。

參考：[Python time](https://docs.python.org/3/library/time.html)、[GNU time](https://www.gnu.org/software/time/)。

## 延伸推演｜遇到變形題怎麼判斷

## CPU 高、Wall Time 高、RSS 高，原因可能完全不同

兩條 Thread 各使用一顆核心做 1 秒純運算，程序的 CPU Time 可能接近 2 CPU-seconds，但 Wall Time 仍接近 1 秒；相反地，等待網路 1 秒可能 Wall Time 高、CPU Time 卻很低。不能看到 CPU 使用率下降就說速度比較快。

RSS 表示程序已駐留的記憶體頁面用量，和 Python 物件大小、C 的 `sizeof`、實際峰值配置量不是同一個數字。`/usr/bin/time -v` 的 Maximum resident set size 可以作一種觀測，但平台和測量定義要說清楚；一般 `time` 命令不一定提供 `-v`。

**紙筆題：** A 版用 2 個 CPU 核心 1 秒完成，B 版只用 1 個核心 1.5 秒完成。B 的總 CPU Time 可能較低，但使用者等待更久；選哪版要先看題目優先要求 Wall Time、CPU 成本還是資源上限。
