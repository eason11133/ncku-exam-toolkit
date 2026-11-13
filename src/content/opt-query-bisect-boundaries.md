---
id: opt-query-bisect-boundaries
title: 排序資料的二分查詢：bisect_left 與 bisect_right
category: Performance Engineering
tags: python, bisect, binary search, boundaries
aliases: opt-query-bisect-boundaries, 排序資料的二分查詢
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/bisect.html
verified: false
updated_at: 2026-11-13
summary: 確認排序條件、重複值、左右開閉區間，避免二分邊界錯誤。
related: ncku-algorithm-query-patterns
---

# 二分查詢：最容易錯的是「到底算不算等於」

你有一份固定資料，要重複問「小於 X 的有幾筆」、「小於等於 X 的有幾筆」，先排序一次可以減少每次查詢的工作。`bisect_left` 與 `bisect_right` 回傳的是**插入位置**，不是資料值，也不保證該值存在。

## 可以直接執行的對照

```python
from bisect import bisect_left, bisect_right
from random import Random

values = [4, 1, 4, 2, 4]
a = sorted(values)    # [1,2,4,4,4]
if not (bisect_left(a, 4) == 2):
    raise RuntimeError("check failed: opt-query-bisect-boundaries")
if not (bisect_right(a, 4) == 5):
    raise RuntimeError("check failed: opt-query-bisect-boundaries")
if not (bisect_right(a, 4) - bisect_left(a, 4) == 3):
    raise RuntimeError("check failed: opt-query-bisect-boundaries")

rng = Random(42)
for _ in range(200):
    a = sorted(rng.randrange(-5, 6) for _ in range(rng.randrange(60)))
    for x in range(-7, 8):
        if not (bisect_left(a, x) == sum(v < x for v in a)):
            raise RuntimeError("check failed: opt-query-bisect-boundaries")
        if not (bisect_right(a, x) == sum(v <= x for v in a)):
            raise RuntimeError("check failed: opt-query-bisect-boundaries")
print('bisect=ok')
```

若原資料未排序，直接使用 bisect 會回傳沒有意義的結果。若資料會被其他執行緒並行修改，不能假設 bisect 可安全查詢；需另設同步。`insort` 的定位雖是 `O(log n)`，插入 list 時仍可能移動 `O(n)` 元素。

## 什麼時候值得先排序？

排序一次 `O(n log n)`，每次查詢 `O(log n)`；只有幾次查詢、資料量又小時，單次線性掃描可能更省。若要找「第一筆大於等於 x」用 `bisect_left`；「第一筆大於 x」用 `bisect_right`。若元素是物件，可指定 `key`，但要注意比較和查詢值的型別要對應。

### 閉區間查詢還有一個陷阱：`L > R`

`bisect_right(a, R)-bisect_left(a, L)` 是**在 L <= R 的前提下**求閉區間筆數。若使用者把範圍輸成 `L=9, R=2`，兩個插入位置的差可能是負數；這不是合理的「負幾筆資料」。題目若允許不合法區間，應明確拋出錯誤或依規格回傳 0，不能默默使用原公式。

```python
from bisect import bisect_left, bisect_right

def count_closed(sorted_values, left, right):
    if left > right:
        raise ValueError('left > right')
    return bisect_right(sorted_values, right) - bisect_left(sorted_values, left)

values = [1, 3, 3, 7]
for left, right, expected in [(3, 3, 2), (2, 6, 2), (-10, 0, 0), (7, 7, 1)]:
    if count_closed(values, left, right) != expected:
        raise RuntimeError('錯誤的閉區間筆數')
try:
    count_closed(values, 9, 2)
except ValueError:
    pass
else:
    raise RuntimeError('顛倒範圍應被拒絕')
print('closed range boundaries PASS')
```

**驗收**：專門測空陣列、全相同、邊界以下／以上、重複數、負數，以及等於門檻的情形。別把 `bisect_left` 當成精確存在檢查，存在判斷還要確認 `i < len(a)` 且 `a[i] == x`。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 二分變形：一口氣求閉區間 [L,R] 的筆數

資料已排序時，小於等於 R 的筆數是 `bisect_right(a,R)`，小於 L 的筆數是 `bisect_left(a,L)`。相減就得到 `L <= x <= R` 的筆數。

<!-- v7-test: full-python -->
```python
from bisect import bisect_left, bisect_right
from random import Random
rng = Random(7)
for _ in range(100):
    a = sorted(rng.randrange(-9,10) for _ in range(rng.randrange(0,30)))
    for left in range(-10, 11, 3):
        for right in range(left, 11, 4):
            fast = bisect_right(a,right)-bisect_left(a,left)
            slow = sum(left <= x <= right for x in a)
            if not (fast == slow):
                raise RuntimeError("example check failed")
print('closed intervals=ok')
```

**限制：** 假如資料每次查詢後都會插入、刪除，而且更新次數很多，維持 Python list 的排序可能要移動 O(N) 個元素；此時要重新評估資料結構。若只查一次，直接掃也可能比較快。

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`binary_bounds_random.py`），與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。直接以 Python 3 執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```python
from bisect import bisect_left,bisect_right
from random import Random
rng = Random(2026)
for _ in range(2000):
    xs = sorted(rng.randint(-10, 10) for _ in range(rng.randint(0, 60)))
    q = rng.randint(-12, 12)
    l,r = bisect_left(xs,q),bisect_right(xs,q)
    if not (l == sum(x<q for x in xs)):
        raise RuntimeError("example check failed")
    if not (r == sum(x<=q for x in xs)):
        raise RuntimeError("example check failed")
    if not (r-l == xs.count(q)):
        raise RuntimeError("example check failed")
    if not ((l<len(xs) and xs[l]==q) == (q in xs)):
        raise RuntimeError("example check failed")
print('bisect duplicate / empty / boundary PASS')
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：兩種二分到底差在哪

陣列 `[1,3,3,3,8]` 已排序。查 `3`：`bisect_left` 得 1，`bisect_right` 得 4。前者是**第一個 `>=3` 的位置**，後者是**第一個 `>3` 的位置**。因此恰好等於 3 的數量是 `4-1=3`，這比「找到其中一個 3」更有用。

查 `2`：兩個邊界都在位置 1；查 `9`：兩者都在 5，這是**合法插入位置**，但不是合法索引。拿到位置 `i` 後若要讀 `a[i]`，一定先檢查 `i<len(a)`。

二分的核心不變式是在一條真假分界上縮小 `[lo,hi)`，所以**資料必須依比較規則排序**。如果查詢期間列表同時被其他 Thread 修改，Python 官方文件不保證 `bisect` 操作的 thread safety；不要只憑 GIL 以為任意並行修改都安全。高頻插入時，找到位置是 `O(log n)`，但插入搬移元素仍可能 `O(n)`。
