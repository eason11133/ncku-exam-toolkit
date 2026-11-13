---
id: opt-topk-large-k-sorted
title: K 接近 N 時，保留 sorted 可能比 Heap 簡單
category: Algorithms
tags: Algorithms, algorithm-topk-heap, 考場判讀
aliases: opt-topk-large-k-sorted, K 接近 N 時，保留 sorted 可能比 Heap 簡單
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/heapq.html
verified: false
updated_at: 2026-11-13
summary: 資料幾乎都需要排序時，避免堆積多餘的程式分支。
related: ncku-v2-algorithm-topk-heap
---

# K 接近 N 時，保留 sorted 可能比 Heap 簡單

## 決策

只要前 3 個最小值、但資料有 100 萬個，保留 K 大小的 Heap 值得考慮；如果需要前 99 萬個，排序整份陣列可能比較合適。這是方向不是固定門檻，應用代表性輸入測試。`heapq` 官方文件也提醒 `n` 大時 `sorted()` 可能更有效率。

<!-- test: full-python -->
```python
from heapq import nsmallest
values=[9,1,5,4,4,8,3]
for k in (0,1,3,7,100):
    expected=sorted(values)[:k]
    if not (nsmallest(k,values)==expected):
        raise RuntimeError("check failed: opt-topk-large-k-sorted")
# 需要完整排序就直接 sorted；它也保留所有元素
all_sorted=sorted(values)
if not (all_sorted == [1,3,4,4,5,8,9]):
    raise RuntimeError("check failed: opt-topk-large-k-sorted")
print("sorted/heap equivalent on sample")
```

若資料是 stream、不能一次放進 RAM，選擇就不同；若 K=N，往往沒必要自己寫 heap 更複雜的實作。排序時間 O(N log N)，K 小的堆選擇常見 O(N log K)，但 Python 的常數成本和資料形狀仍需實測。

**驗收**：以固定亂數種子測多組 N、K 和重複值，逐項比對完整輸出，再量測時間、峰值 RAM，不得只看最快一輪。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/heapq.html
- 完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 先問「要前 K 個」還是「每個元素都排序」

例如 `values=[8,2,7,2,5]`，若只要最小 2 個，答案是 `[2,2]`；若題目要求全部升冪，則是 `[2,2,5,7,8]`。Heap 適合不必保留所有元素順序的情況；整份 `sorted` 則是排序所有元素。兩者的輸出需求不同時，不應直接拿執行時間比較。

如果 `N=1000000`、`K=3`，使用 Heap 保留少量候選通常比較合理；如果 `K` 幾乎等於 `N`，完整排序可能比較簡單甚至更快。**K/N 並沒有一個適用所有硬體、Python 版本和資料形狀的固定界線**。先用題目資料規模判斷，再測時間與記憶體。

### 平手怎麼處理，最容易被忽略

假設是 `(distance, name)`，你寫 `sorted(data, key=lambda x: x[0])`，Python 的穩定排序會保留距離相同的原順序。若你改成 Heap 比較 `(distance, name)` tuple，距離相同時又會以 `name` 決定順序。兩者可能選到不同的人，不能因為距離數字相同就說輸出正確。

最安全的方式是先讀題目：平手按原順序、按 ID，還是任意皆可？必要時把 `(distance, original_index, item)` 當成比較 key，讓規則明確。

### 可直接執行的邊界測試

<!-- v8-extra: full-python -->
```python
from heapq import nsmallest
from random import Random
rng = Random(20261113)
for n in (0, 1, 2, 5, 30, 100):
    for _ in range(40):
        data = [rng.randrange(-3, 4) for i in range(n)]
        for k in (0, 1, 2, n//2, n, n+3):
            got = nsmallest(k, data)
            want = sorted(data)[:k]
            if got != want:
                raise SystemExit((n, k, data, got, want))
items = [(2, 'B'), (1, 'A'), (2, 'C')]
by_distance = nsmallest(2, items, key=lambda x: x[0])
if by_distance != [(1, 'A'), (2, 'B')]:
    raise SystemExit(by_distance)
print('top-k boundary comparisons passed')
```

這段證明本機 `nsmallest` 和 `sorted` 對這些輸入的結果一致，**不證明哪個比較快**。真要比較性能，需固定隨機種子、N/K、資料型態和計時範圍，多次量測後看中位數；不要只比最快一次。
