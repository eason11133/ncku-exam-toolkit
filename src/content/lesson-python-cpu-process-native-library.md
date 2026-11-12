---
id: lesson-python-cpu-process-native-library
title: 評估 NumPy / 原生計算函式
category: Performance Engineering
tags: multiprocessing, Python CPU-bound／Process Pool, 效能優化
aliases: native-library, python-cpu-process
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/threading.html
verified: false
updated_at: 2026-11-12
summary: 若現有程式可用原生向量化避免 Python 層迴圈，可能更有效。
related: ncku-ros2-executor
---

# 評估 NumPy / 原生計算函式

## 先弄懂這個問題

目前的方法是 **Python CPU-bound／Process Pool**。普通 GIL 啟用 CPython 的純 Python 計算執行緒不會自動在多核心同時執行位元碼。

這個方案的目的是：原生實作可減少 Python 直譯成本；部分操作會釋放 GIL，但依函式而定。

你可以先想像這個情境：需要計算大量數值平方和，Python for 迴圈太慢。

## 修改前：先看哪裡有問題

```python
total = 0
for x in values:
    total += x * x
```

## 修改後：對照實作

```python
# 需要既有 NumPy 環境；先確認型別及溢位規則
import numpy as np
array = np.asarray(values, dtype=np.float64)
total = float(np.dot(array, array))
```

## 逐步理解，為什麼這樣改

NumPy 使用原生實作，對大陣列常有效，但多了一份資料轉換與額外依賴。此例的結果型別改成浮點數，整數大值時可能跟原本精確的 Python int 不相同，不能忽略。

## 什麼情況才適合

- 考場環境已安裝對應套件
- 輸入形狀與數值規格明確

## 常見錯誤與代價

- 新增依賴不一定可用
- 浮點精度與溢位行為可能不同

**正確性界線：** 用隨機／邊界輸入比對數值、速度與記憶體。

## 怎麼做測試

用長度 0、1、100、10^6 和大整數值測正確性及速度，檢查依賴是否已安裝。

優先觀察：time、CPU、RSS、結果精度。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **Python CPU 100%** 或 **高比例純 Python CPU 計算** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Python threading](https://docs.python.org/3/library/threading.html)
