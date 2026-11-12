---
id: ncku-algorithm-query-patterns
title: 反覆查詢太慢：先換對演算法與資料結構
category: Performance Engineering
tags: algorithm, hash, set, dict, binary search, prefix sum, complexity
aliases: 線性掃描, 重複查詢, 演算法複雜度, 查表, 區間和
source_type: personal
source_url: https://docs.python.org/3/library/stdtypes.html#set-types-set-frozenset
verified: false
updated_at: 2026-11-12
summary: 看到 O(n) 的掃描藏在迴圈裡，先確定查詢種類，再選 set、排序與二分、Prefix Sum。
related: ncku-incremental-cache, ncku-performance-benchmark
priority: P0
difficulty: intermediate
---

# 反覆查詢很慢，先看每次到底在查什麼

## 30 秒判斷

程式不是只有「執行某個函式很慢」才有問題。有時一個很短的 `for`，每次都重複掃描同一批資料，整體就變成 `O(n × q)`：`n` 是資料量，`q` 是查詢次數。

先問：查的是**某個值存不存在**、**有序資料的位置**、還是**一段範圍的總和**？這三種問題需要的工具不一樣。不要看到迴圈就機械式改成 `dict`。

| 查詢需求 | 原本常見寫法 | 可考慮 | 建立成本 | 查詢成本 |
|---|---|---|---|---|
| 反覆查「某個值存在嗎」 | 每次掃描 list | `set` | 平均 O(n) | 平均 O(1)，最壞可能 O(n) |
| 靜態有序數值找門檻 | 每次從頭找位置 | `bisect_left` | 若先排序 O(n log n) | O(log n) |
| 靜態陣列大量區間和 | 每次 `sum(a[l:r])` | Prefix Sum | O(n) | O(1) |

**這些是理論複雜度，不是實測秒數。** 建立資料結構本身也有成本；只有一兩次查詢時，直接掃描可能比較快。

## 方案 A：反覆查「是否存在」→ `set`

```python
# 修改前：每次查詢都從頭找，最壞 O(nq)
def before(allowed, incoming):
    return [x for x in incoming if x in allowed]

# 修改後：建立一次 set，再查 q 次，平均 O(n + q)
def after(allowed, incoming):
    known = set(allowed)
    return [x for x in incoming if x in known]

assert before([2, 5, 7], [7, 1, 5, 7]) == after([2, 5, 7], [7, 1, 5, 7])
```

注意輸出仍依照 `incoming` 的順序，且重複值仍保留。這和 `list(set(incoming) & set(allowed))` 不一樣，後者會去掉重複值、順序也不能拿來保證一樣。

不要使用這個方案的情況：你需要 `allowed` 的位置、重複次數或原始順序；或者 `allowed` 會頻繁更動，而查詢很少。把更新成本也算進去。

## 方案 B：靜態有序資料的門檻查詢 → `bisect`

需求是「有幾個數值小於 `threshold`」：

```python
from bisect import bisect_left

values = [9, 2, 5, 5, 1]
sorted_values = sorted(values)  # 只排序一次

for threshold in [0, 5, 6, 20]:
    slow = sum(x < threshold for x in values)
    fast = bisect_left(sorted_values, threshold)
    assert slow == fast
```

排序要在迴圈**外面**。如果每次查詢都重新 `sorted(values)`，建立成本會反覆付出。

`bisect_left` 找的是插入位置：有重複值時，它會選擇最左邊的位置，因此剛好等於「小於門檻的數量」。如果改成 `bisect_right`，數量變成「小於等於門檻」。

需要大量插入時不要以為 `insort` 也是 `O(log n)`：Python list 中間插入要搬動元素，整體仍可能 `O(n)`。有序陣列不是所有動態資料問題的通用解法。

## 方案 C：靜態陣列的區間總和 → Prefix Sum

假設有很多查詢，每次要計算位置 `[l, r)`（左包含、右不包含）的總和：

```python
a = [3, -2, 5, 7]
prefix = [0]
for x in a:
    prefix.append(prefix[-1] + x)

queries = [(0, 4), (1, 3), (2, 2)]
for l, r in queries:
    slow = sum(a[l:r])
    fast = prefix[r] - prefix[l]
    assert slow == fast
```

`prefix[i]` 表示「前 i 個數字總和」。因此 `[l, r)` 就是 `prefix[r] - prefix[l]`，空區間也正確得到 0。不要把 `[l, r]`（兩端包含）混成同一種規格。

如果陣列會頻繁更新，先前的 Prefix Sum 就失效；可能需要重新計算，或考慮 Fenwick Tree / Segment Tree，但那是另外一種問題。

## 怎麼在陌生專案裡找修改點

先搜尋這種模式：

```python
for query in queries:
    for item in items:  # 每筆 query 都重掃 items
        ...
```

不要只因為看見雙層迴圈就說是 `O(n²)`。兩個迴圈可能處理不同大小的資料，也可能在迴圈裡提早結束。用真實的 `n`、`q` 定義工作量，再計算。

## 測試：不要只比速度

1. 固定資料和查詢，先記錄修改前後每一筆答案，包含重複值、空資料、負數、區間邊界。
2. 將建立索引／排序的成本一起計入整體耗時，不要只量第二次查詢。
3. 設置兩種負載：少量查詢、大量查詢。確認新方法是否只有大量查詢才值得。
4. 比較峰值記憶體：`set`、排序副本與 Prefix Sum 都會增加額外空間。

**交給考場 LLM 的重點**：請先找出重複線性掃描的位置，說明查詢要求是否有順序、重複和動態更新，再提出最低風險的替代結構。修改後跑同一份測試資料，才評估速度。

**查證狀態**：複雜度與用法參考 Python 官方文件；示例為通用 Python 範例，未在考場專案上實測。

來源：[Python set](https://docs.python.org/3/library/stdtypes.html#set-types-set-frozenset)、[bisect](https://docs.python.org/3/library/bisect.html)。
