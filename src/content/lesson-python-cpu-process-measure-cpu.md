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

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

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

牆上時間包含等待，`process_time` 是當前程序 CPU 時間。兩者一起看有助於區分等待與運算，但多執行緒、多進程時 CPU 時間的解讀要更謹慎。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 可區分等待與計算
- 有 wall/CPU 量測

## 常見錯誤與代價

- 程序間傳輸成本可能高於計算
- C 原生套件可能釋放 GIL

**正確性界線：**記錄不同工作量與多核心情況。

## 怎麼做測試

重複多次並用 profiler/系統工具交叉確認；輸入大小變化時觀察時間曲線。

優先觀察：CPU、time、throughput。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **Python CPU 100%** 或 **高比例純 Python CPU 計算** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Python threading](https://docs.python.org/3/library/threading.html)
- [Python concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
