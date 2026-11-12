---
id: ncku-incremental-cache
title: 重複計算太多：增量更新、Rolling Window 與 Cache
category: Performance Engineering
tags: incremental, cache, lru_cache, streaming, rolling window, Python
aliases: 增量計算, 滑動視窗, 快取, 重算, memoization
source_type: personal
source_url: https://docs.python.org/3/library/functools.html#functools.lru_cache
verified: false
updated_at: 2026-11-12
summary: 每筆資料到來都重算整個歷史時，評估只更新變動部分；同一輸入重複算時才考慮快取。
related: ncku-algorithm-query-patterns, ncku-ros2-executor
priority: P0
difficulty: intermediate
---

# 每次訊息來都重算：需要算的可能只有最後那一筆

## 先分清兩種浪費

- **重算歷史**：已經算過前 999 筆，第 1000 筆來時又把 1000 筆全部掃一遍。可考慮增量更新。
- **相同輸入重複呼叫**：兩次 `f(x)` 的 `x` 完全相同、結果也不會變，卻又做昂貴計算。可考慮 Cache。

兩者不是同一件事。增量更新維護「目前狀態」；Cache 記錄「某組輸入曾算過的答案」。

## 方案 A：從頭算總和 → 增量加總

```python
# 每來一筆新資料都重新 sum 全部歷史
history = []
slow_results = []
for x in [2, 4, -1, 5]:
    history.append(x)
    slow_results.append(sum(history))

# 如果順序只會 append，保留累積值即可
running = 0
fast_results = []
for x in [2, 4, -1, 5]:
    running += x
    fast_results.append(running)

assert slow_results == fast_results == [2, 6, 5, 10]
```

重算歷史的總成本隨訊息數增加得很快；增量加總每筆只做一次加法，維持 O(1) 更新。但如果允許修改歷史元素、撤銷資料，簡單的 `running += x` 就不足以處理所有情況。

## 方案 B：最近 N 筆平均值 → Rolling Window

例如每次要顯示最近 3 筆的平均：

```python
from collections import deque

window_size = 3
window = deque()
window_sum = 0
out = []
for x in [2, 4, 8, 10, 1]:
    if len(window) == window_size:
        window_sum -= window.popleft()
    window.append(x)
    window_sum += x
    out.append(window_sum / len(window))

assert out == [2.0, 3.0, 14/3, 22/3, 19/3]
```

`deque.popleft()` 適合從最前面移除一筆；Python list 的 `pop(0)` 會搬移後面元素。上面每筆維持固定大小視窗，但記憶體仍需 O(N)。

如果資料有**時間窗口**（例如最近 3 秒），窗口是否到期要比較時間戳，而不是固定最近 3 筆；兩者不可混用。若訊息允許亂序到達，還需要定義排序與遲到資料的處理方式。

## 方案 C：同樣的昂貴純函式輸入 → 有上限的 Cache

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def heavy_lookup(key: int) -> int:
    # 這裡用簡單公式示範；真正值得快取的通常是昂貴且重複的工作
    return key * key + 1

assert heavy_lookup(12) == heavy_lookup(12)
print(heavy_lookup.cache_info())
```

`@lru_cache` 需要可雜湊的參數，且適合相同輸入能穩定得到相同結果的函式。它不會自動知道設定檔、資料庫、外部感測器狀態更新了。若結果依賴會變動的外部狀態，必須先設計如何清除／更新快取，否則快取可能讓結果變錯。

多執行緒下 `lru_cache` 的資料結構有同步保護，但**同一個尚未快取完成的呼叫仍可能被不同執行緒重複計算**。不要把 Cache 當成互斥鎖。

## 什麼時候會變差？

- 每次輸入都不同：Cache 命中率低，還付出查找與佔用記憶體的成本。
- 真正負擔是資料傳輸或 I/O：只優化計算，不會解決其他階段的瓶頸。
- 流水線有遺失、重送、亂序：增量狀態可能重複加或漏加，必須先定義更新規則。
- 你只用少量測試資料：原本的重算方法可能更簡單，也已經夠快。

## 實際驗證

先用同一串輸入跑「重算版本」與「增量版本」，逐筆對照結果，不只比較最後一個總和。測試包含空串流、負數、窗口還沒滿、窗口恰好滿、重複資料。再比較不同長度負載的整體耗時和記憶體。

對 Cache 要另外記錄 `cache_info().hits` 和 `misses`，並測試外部資料更新後是否讀到舊資料。高命中率也不保證總體延遲下降，仍需實測。

**查證狀態**：概念與標準函式依 Python 官方文件，示例不是正式考試專案的實測優化。

來源：[functools.lru_cache](https://docs.python.org/3/library/functools.html#functools.lru_cache)、[collections.deque](https://docs.python.org/3/library/collections.html#collections.deque)。
