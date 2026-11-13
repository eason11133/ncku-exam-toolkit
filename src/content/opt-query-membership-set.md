---
id: opt-query-membership-set
title: 大量 membership 查詢：用 set，但保留輸出次序
category: Performance Engineering
tags: python, set, membership, algorithm
aliases: opt-query-membership-set, 大量 membership 查詢
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/stdtypes.html
verified: false
updated_at: 2026-11-13
summary: 大量 list membership 查詢時，先確認元素可 hash、輸出重複值是否要保留，再轉 set。
related: ncku-algorithm-query-patterns
---

# 大量 membership 查詢：什麼時候 set 真有用？

如果有 `allowed` 這份很長的清單，另一份 `incoming` 要逐項確認是否在清單內，直接寫 `x in allowed` 每次可能掃很多元素。如果 `allowed` 不會頻繁改變、元素可 hash，先建一次 `set` 再查通常更合適。

## 實際範例：輸入次序與重複不能被消掉

```python
from random import Random

def original(allowed, incoming):
    return [x for x in incoming if x in allowed]

def improved(allowed, incoming):
    lookup = set(allowed)
    return [x for x in incoming if x in lookup]

if not (improved([2, 5, 7], [5, 2, 5, 9]) == [5, 2, 5]):
    raise RuntimeError("example check failed")
rng = Random(11)
for _ in range(200):
    allowed = [rng.randrange(100) for _ in range(rng.randrange(35))]
    incoming = [rng.randrange(100) for _ in range(rng.randrange(50))]
    if not (original(allowed, incoming) == improved(allowed, incoming)):
        raise RuntimeError("example check failed")
print('membership=ok')
```

`set(incoming) & set(allowed)` **不等價**：它會改變重複值和輸出順序。若題目要「每筆查詢都回答」，應保留 `incoming` 原順序。

## 成本與反例

令 `n=len(allowed)`、`q=len(incoming)`。線性查找最壞約 `O(nq)`；建立 set 預期 `O(n)`，查詢平均 `O(q)`。但 hash table 會多占記憶體；元素若是 list、dict 等不可 hash，不能直接 `set(allowed)`。只有一兩次查詢且清單很小時，建 set 未必值得。若 `allowed` 更新頻繁，需同步更新 set 或在適當時機重建，不能用舊快取。

**考場判斷**：程式慢在重複 membership，而且不依賴原清單的重複次數時才選這個方案。驗收要測空清單、重複輸入、順序、資料變更，並和原版逐筆比對；不要只測耗時。
