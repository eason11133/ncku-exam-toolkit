---
id: lesson-python-cpu-process-process-pool
title: 純計算搬到 ProcessPoolExecutor
category: Performance Engineering
tags: multiprocessing, Python CPU-bound／Process Pool, 效能優化
aliases: process-pool, python-cpu-process
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/concurrent.futures.html
verified: false
updated_at: 2026-11-12
summary: 每個 Process 可各自執行計算，但要傳送資料和收回結果。
related: ncku-ros2-executor
---

# 純計算搬到 ProcessPoolExecutor

## 先弄懂這個問題

目前的方法是 **Python CPU-bound／Process Pool**。普通 GIL 啟用 CPython 的純 Python 計算執行緒不會自動在多核心同時執行位元碼。

這個方案的目的是：計算被拆成獨立純函式，才可能跨 Process 使用多核心。

你可以先想像這個情境：一個 CPU-heavy 函式對彼此獨立的資料塊做計算。

## 修改前：先看哪裡有問題

```python
results = [heavy_calculation(chunk) for chunk in chunks]
```

## 修改後：對照實作

```python
from concurrent.futures import ProcessPoolExecutor
# heavy_calculation 必須定義在模組頂層，參數/結果可 pickle
if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(heavy_calculation, chunks))
```

## 逐步理解，為什麼這樣改

多個 Process 有各自的 interpreter，可讓 CPU-heavy 工作分散到多核心，但會增加啟動、序列化和跨程序傳輸成本。ROS 2 node 及 publisher 不要直接傳入子程序。

## 什麼情況才適合

- 計算函式可 pickle
- 資料分塊夠大
- 結果順序需求明確

## 常見錯誤與代價

- 建立 Process、pickle、IPC 成本
- ROS 2 Node 物件不能隨意跨程序

**正確性界線：** 不應在 Executor Callback 立即 blocking wait；結果需配對來源。

## 怎麼做測試

用小、中、大工作負載測速度與記憶體；確認輸出順序、例外處理和 worker 結束。

優先觀察：總耗時、CPU、序列化時間、RSS。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **Python CPU 100%** 或 **高比例純 Python CPU 計算** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Python concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html)
