---
id: opt-algorithm-topk-ties
title: Top-K 與 Heap：有平手時怎麼保留正確排序
category: Performance Engineering
tags: Top K,heapq,nlargest,stable tie,Python,big O
aliases: topk,前K名,heap,heapq,平手排序
source_type: personal
source_url: https://docs.python.org/3/library/heapq.html
verified: false
updated_at: 2026-11-13
summary: 只有前 K 名時可比較 Heap 與排序，但必須先處理重複值、平手順序和 K 的邊界。
related: ops-perf-test-protocol
priority: P0
difficulty: intermediate
---

# 先決定題目要的是「前 K 個值」還是「前 K 筆紀錄」

如果只有數值且不在乎平手來源，可先用 `heapq.nlargest(k, values)` 比較完整 `sorted(values, reverse=True)[:k]`。但如果資料是「分數＋原始位置」，平手可能需要保留原始順序，不能只把數值塞進 Heap。`set()` 也不能用來做 Top-K，因為它會去掉重複值。

## 完整 Python 3 範例：分數高者優先，平手時原始位置小者優先

```python
from heapq import heappush, heapreplace

def topk(scores, k):
    if k < 0:
        raise ValueError("k must be nonnegative")
    if k == 0:
        return []
    heap = []
    for index, score in enumerate(scores):
        key = (score, -index)
        if len(heap) < k:
            heappush(heap, key)
        elif key > heap[0]:
            heapreplace(heap, key)
    return [(score, -negative_index)
            for score, negative_index in sorted(heap, reverse=True)]

sample = [9, 4, 9, 7, 7]
assert topk(sample, 3) == [(9, 0), (9, 2), (7, 3)]
assert topk(sample, 0) == []
assert topk(sample, 9) == [(9, 0), (9, 2), (7, 3), (7, 4), (4, 1)]
print("topk=ok")
```

這個範例只處理**可以用 `>` 比較的數值分數**，不代表適用任意不可比較物件；也不處理分數是 NaN 的情況。若題目規格對平手另有順序，需改比較 key。

## 複雜度與代價

維持最多 K 個項目，掃描 N 筆時間約 `O(N log K)`，最後排序 K 筆 `O(K log K)`，額外空間 `O(K)`。完整排序一般是 `O(N log N)`；當 K 接近 N 時，完整排序的常數成本可能更有利，所以必須用相同測資實測。`heapq.nlargest()` 也是可選方案，不一定要自己手寫 Heap。

## 考場檢查

測空資料、K=0、K=1、K=N、K>N、K 為負、所有分數相同、重複最大值、負數分數，以及是否需要輸出原始索引。不要把結果元素個數少了、平手順序亂掉卻比較快，當成有效優化。

---

## 深讀：要的是「前 K 個值」還是「前 K 筆資料」？

假設成績表是 `[9, 7, 9, 7, 5]`，你要最高三筆，而且**同分時原始出現較早者排前面**。答案應是 `(9,0)、(9,2)、(7,1)`，不是只印 `[9,9,7]`，也不是把分數放進 `set()` 後只剩 `[9,7]`。

這裡的 Heap key 用 `(score,-index)`，是因為 Python tuple 先比 score；平手再比較 `-index`，所以較早的 index（較大的 `-index`）優先。若題目改成「同分時編號較大者先」，key 也要跟著改。這就是**先讀輸出規格**，不是先背 Heap 模板。

| 方法 | 大致時間 | 何時合適 | 危險點 |
|---|---|---|---|
| 完整 `sorted` | `O(N log N)` | K 接近 N，需要完整排序 | 比較 key 有沒有照題目定義 |
| 維持 K 大小 Heap | `O(N log K)`，最後 `O(K log K)` | K 遠小於 N，可逐筆處理 | 平手、負數、重複值、K=0 |
| `heapq.nlargest` | API 會依輸入規模選擇策略 | 不想自己維護 Heap | key 和結果穩定性仍需核對 |

**自行驗收的最好方法**：先寫一份清楚但可能慢的參考答案 `sorted(enumerate(scores), key=lambda t:(-t[1],t[0]))[:k]`；再用同一批隨機資料對照 Heap 版本。測資不能只放五筆：要測大量重複分數、K>N、全負數、空輸入和所有值都一樣。這個包附有 `quality_v9/examples/topk_reference_random.py` 做差異對照。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：Top-K 先定義「誰算比較前面」

如果只說取前三小，值為 `[4,2,2,5,2]` 時，你可以得到 `[2,2,2]`；但如果每筆還帶有 ID，考題可能要求同值依 ID 排序，或要保留原始輸入順序。這些答案**不能只用 `score` 一個欄位決定**。

假設資料是 `(score,id)`：`[(2,'B'),(2,'A'),(1,'X'),(2,'C')]`，需求是先依 score 升冪、同分依 id 字母順序，K=3。正確結果是 `[(1,'X'),(2,'A'),(2,'B')]`。若同分要求輸入先後，就應在 key 加上原始 index；不要把字母順序誤當穩定排序。對較小 K 可比較 `heapq.nsmallest(K, items, key=...)` 和全排序，但兩者都要用同一個比較規則。

**驗收：** K=0、K>N、全同分、負分、重複 ID、空輸入。資料量大時先核對正確性，再量比較次數和額外記憶體；K 接近 N 時不一定是 Heap 最好。
