---
id: lesson-python-cpu-process-measure-cpu
title: 先判斷是否真的 CPU-bound
category: Performance Engineering
tags: multiprocessing, Python CPU-bound／Process Pool, 效能優化
aliases: measure-cpu, python-cpu-process
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/threading.html
verified: false
updated_at: 2026-11-12
summary: 若時間主要花在 I/O 等待，換 Process 未必有益。
related: ncku-ros2-executor
---

# 先判斷是否真的 CPU-bound

## 先弄懂這個問題

目前的方法是 **Python CPU-bound／Process Pool**。普通 GIL 啟用 CPython 的純 Python 計算執行緒不會自動在多核心同時執行位元碼。

這個方案的目的是：I/O 等待可讓其他工作執行；純 Python CPU 計算則受一般 GIL 限制。

你可以先想像這個情境：收到訊息要等 300ms，不確定是睡眠、網路還是計算。

## 修改前：先看哪裡有問題

```python
start = time.perf_counter()
result = handle(msg)
print(time.perf_counter() - start)
```

## 修改後：對照實作

```python
start_wall = time.perf_counter()
start_cpu = time.process_time()
result = handle(msg)
wall = time.perf_counter() - start_wall
cpu = time.process_time() - start_cpu
print(f"wall={wall:.3f}s cpu={cpu:.3f}s")
```

## 逐步理解，為什麼這樣改

牆上時間包含等待，`process_time` 是當前程序 CPU 時間。兩者一起看有助於區分等待與運算。`process_time()` 累計整個程序所有執行緒的 CPU 時間，不是這段函式或單一 Callback 的專屬時間；若只需目前執行緒的 CPU 時間，可在同一執行緒的開始與結束使用 `time.thread_time()`，但其他程序的時間仍須各自量測。

## 什麼情況才適合

- 可區分等待與計算
- 有 wall/CPU 量測

## 常見錯誤與代價

- 程序間傳輸成本可能高於計算
- C 原生套件可能釋放 GIL

**正確性界線：** 記錄不同工作量與多核心情況。

## 怎麼做測試

重複多次並用 profiler/系統工具交叉確認；輸入大小變化時觀察時間曲線。

優先觀察：CPU、time、throughput。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


尚未確認工作是 CPU-bound 還是 I/O 等待時，先比較牆上時間與適當範圍的 CPU 時間。process_time 是整個程序 CPU 時間，不能直接當成某個 Callback 自身的 CPU 時間。

## 參考文件與驗證狀態

- [Python `time.process_time()` 與 `time.thread_time()`](https://docs.python.org/3/library/time.html#time.process_time)
- [Python threading](https://docs.python.org/3/library/threading.html)
- [Python concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html)
