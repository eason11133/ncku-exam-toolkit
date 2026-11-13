---
id: opt-stream-rolling-window
title: 固定 N 筆視窗：deque 加總不漏扣舊值
category: Performance Engineering
tags: python, deque, rolling, sliding window
aliases: opt-stream-rolling-window, 固定 N 筆視窗
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/collections.html#collections.deque
verified: false
updated_at: 2026-11-13
summary: 滑動視窗每加入新值先去掉過期值；區分按筆數和按時間的窗口。
related: ncku-incremental-cache
---

# Rolling Window：窗口內的和／平均值怎麼維持？

題目只看「最近 N 筆」而不是全部歷史。每筆都 `sum(values[-N:])` 會重掃窗口。用 `deque` 保存最近 N 筆，加入時扣掉即將離開的舊值，再加新值，可以維持窗口總和。

```python
from collections import deque
from random import Random

def rolling_averages(values, width):
    if width <= 0:
        raise ValueError('width must be positive')
    window = deque()
    total = 0
    ans = []
    for value in values:
        if len(window) == width:
            total -= window.popleft()
        window.append(value)
        total += value
        ans.append(total / len(window))
    return ans

rng = Random(12)
for width in range(1, 12):
    for _ in range(100):
        data = [rng.randrange(-50, 51) for _ in range(rng.randrange(50))]
        expected = [sum(data[max(0, i-width+1):i+1]) /
                    min(width, i+1) for i in range(len(data))]
        assert rolling_averages(data, width) == expected
print('rolling=ok')
```

前 `N-1` 筆時窗口尚未滿：這份範例用**已有筆數**當除數。若題目要求「未滿 N 不輸出」，那就是另一個規格，不能拿這段直接套。`deque(maxlen=N)` 也會自動丟最舊元素，但如果你要維護 `total`，必須在 append 前知道是哪一筆被丟掉。

## 適用範圍

這是按**筆數**的窗口，不能自動處理「最近 3 秒」之類按時間窗口；後者需 timestamp、遲到事件和過期判斷。每筆更新約 `O(1)`、窗口空間 `O(N)`。Python float 若數量大可能有累積誤差，要按題目精度規範比較。驗收測 N=1、N 大於資料長度、負值、重複值，以及空串流。
