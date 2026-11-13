---
id: opt-query-prefix-range
title: 靜態區間和：Prefix Sum 的 [l,r) 邊界
category: Performance Engineering
tags: python, prefix sum, static queries, boundaries
aliases: opt-query-prefix-range, 靜態區間和
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/itertools.html
verified: false
updated_at: 2026-11-13
summary: 對靜態陣列多次區間求和，前綴和降低每次查詢成本；明確標注半開區間。
related: ncku-algorithm-query-patterns
---

# Prefix Sum：多次區間求和時別反覆重掃

資料固定、題目一直查某段數字加總，若每次都 `sum(values[l:r])`，會重走該區間。先建立長度 `n+1` 的前綴和，半開區間 `[l,r)` 就是 `prefix[r]-prefix[l]`。

## 有測試的 Python 範例

```python
from random import Random

def build_prefix(values):
    prefix = [0]
    for value in values:
        prefix.append(prefix[-1] + value)
    return prefix

def range_sum(prefix, left, right):
    if not (0 <= left <= right < len(prefix)):
        raise ValueError('invalid [left,right)')
    return prefix[right] - prefix[left]

rng = Random(7)
for _ in range(80):
    data = [rng.randrange(-20, 21) for _ in range(rng.randrange(50))]
    p = build_prefix(data)
    for l in range(len(data) + 1):
        for r in range(l, len(data) + 1):
            if not (range_sum(p, l, r) == sum(data[l:r])):
                raise RuntimeError("example check failed")
print('prefix=ok')
```

`prefix[0]=0` 是核心：它讓 `l=0` 也不需要特判。若題目寫閉區間 `[l,r]`，要轉成 `prefix[r+1]-prefix[l]`，**前提是 r 為有效索引**。

## 容易踩到的限制

前處理 `O(n)`，每次查詢 `O(1)`，額外空間 `O(n)`。如果原陣列中途修改，舊 prefix 就不正確；頻繁更新／查詢混用應考慮 Fenwick Tree、Segment Tree 或重新計算。Python 整數不會像固定寬度 C signed integer 那樣無聲 overflow，但若把相同寫法移到 C，要先分析累加值的最大範圍。

**考場驗收**：空陣列、單筆、全負、l=r、l=0、r=n、最後一格，以及不合法範圍。先用原本 `sum()` 作為正確性基準，測過再比較大量查詢時間。
