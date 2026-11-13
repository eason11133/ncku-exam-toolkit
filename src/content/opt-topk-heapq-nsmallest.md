---
id: opt-topk-heapq-nsmallest
title: Top-K 很小時用 heapq.nsmallest／nlargest
category: Algorithms
tags: Algorithms, algorithm-topk-heap, 考場判讀
aliases: opt-topk-heapq-nsmallest, Top-K 很小時用 heapq.nsmallest／nlargest
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/heapq.html
verified: false
updated_at: 2026-11-13
summary: K 遠小於 N 的情況可避免全排序，但要明確定義平手順序。
related: ncku-v2-algorithm-topk-heap
---

# Top-K 很小時用 heapq.nsmallest／nlargest

## 要選哪個 API

Python `heapq.nsmallest(k, items)` 與 `nlargest` 都會回傳已排序的 K 筆。當 K 相對 N 很小時有優勢；但 `k >= N` 時通常直接 `sorted` 更適合。若題目要求重複值與同分排序，不能只看 score。

<!-- test: full-python -->
```python
import heapq
rows = [(10,"A"),(5,"B"),(5,"C"),(7,"D")]
# 記錄原始序號，顯式規定：分數相同時先出現者優先
ranked = [(score,i,name) for i,(score,name) in enumerate(rows)]
small = heapq.nsmallest(3, ranked)
assert [x[2] for x in small] == ["B","C","D"]
assert heapq.nsmallest(0, ranked) == []
assert len(heapq.nsmallest(99, ranked)) == 4
print(small)
```

**驗收**：K=0、K=1、K=N、K>N，含相同分數、負數與不同資料順序；對照 `sorted(ranked)[:k]`。如果只需要一筆最大值，`max()` 可能更直觀。

**限制**：這個示例用 tuple 當排序規則；若實際資料是 dict、class 或字串混合型別，必須顯式提供 key，不可依賴 Python 能比較不同資料型別。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/heapq.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 為什麼 K 的大小會改變答案？

你有 100,000 筆成績，只要最低 5 筆。全部排序會得到所有人的完整順序，但題目根本不需要全部。可考慮維護只有 5 筆資料的 Heap，或者使用 `heapq.nsmallest`。如果 K=99,999，大部分資料都要輸出，完整排序反而容易且可能更快。

「平手怎麼辦」必須先訂：若相同分數按原輸入順序保留，就用 `(score, original_index, item)` 做比較 Key。

<!-- v7-test: full-python -->
```python
from heapq import nsmallest
rows = [{'score':5,'id':'A'}, {'score':3,'id':'B'},
        {'score':3,'id':'C'}, {'score':1,'id':'D'}]
ranked = [(row['score'], i, row['id']) for i, row in enumerate(rows)]
assert [r[2] for r in nsmallest(3,ranked)] == ['D','B','C']
assert nsmallest(0,ranked) == []
assert [r[2] for r in nsmallest(99,ranked)] == ['D','B','C','A']
print('top-k tie rule ok')
```

**比較複雜度時別漏掉建立成本：** 全排序是 O(N log N)；維護 K 筆的 Heap 常見做法是 O(N log K)，額外空間 O(K)，但 Python 函式的常數成本也可能影響小資料量。不能光看 Big-O 就宣布某個方法在考場一定比較快。
