---
id: opt-stream-running-sum
title: 串流增量累加：何時可代替全部重算
category: Performance Engineering
tags: python, streaming, incremental state, append-only
aliases: opt-stream-running-sum, 串流增量累加
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/functions.html#sum
verified: false
updated_at: 2026-11-13
summary: append-only 串流以 running sum 更新；不能忘記事件重播、刪除或順序改變的影響。
related: ncku-incremental-cache
---

# 串流增量累加：為什麼可以 `O(1)` 更新？

若每次收到一筆新數字，都要輸出「目前累積總和」，重算 `sum(all_values)` 會重複掃歷史資料。只要事件是 append-only、每筆只處理一次，可以保留 `running`，每次加上新的 `value`。

```python
from random import Random

def running_sums(values):
    total = 0
    for value in values:
        total += value
        yield total

rng = Random(5)
for _ in range(100):
    values = [rng.randint(-10, 10) for _ in range(rng.randrange(100))]
    expected = [sum(values[:i]) for i in range(1, len(values) + 1)]
    assert list(running_sums(values)) == expected
assert list(running_sums([])) == []
print('incremental=ok')
```

`running` 只對**同一條已處理序列**有效。若系統斷線後重送同一事件，直接再加會重複計數；若會撤銷、修改舊值，還需要補償事件或重新建狀態。若輸出需要每次對整份資料計算非線性操作（例如精確 median），只有 running sum 不夠。

## 驗收與效能

每筆增量 `O(1)`、儲存狀態 `O(1)`（不算你另外留存的歷史資料）。基準重算若每次累積 `i` 筆，總成本可到 `O(n²)`。用事件序號檢查重送、缺筆和亂序；用原始完整重算結果逐項對照。若是 C 程式，還必須處理整數範圍，不能把 signed overflow 當成正確的繞回。

**不能用的情況**：歷史資料會隨意插入／刪除且沒有重新計算或撤銷機制；或題目要求每次整體重新排序等不同語意。
## 深讀延伸｜把原理放進真實情境
## 增量更新的前提是：你知道每一筆事件代表什麼

資料依序到達 `3, -1, 5`，完整前綴和應是 `3, 2, 7`。每次都 `sum(data[:i])` 會重算舊資料；`running += value` 則每新來一筆只多一次加法，更新成本是 O(1)。但這個 O(1) 只適用於**只追加、且每個事件都恰好算一次**的情況。

變形一：資料來源因網路重送 `-1` 一次。若你直接相加，就變成 `3,2,1,6`，其實重複扣了一次；要靠事件 ID 或題目規格判斷去重。變形二：原本的 3 被更正為 4，只有 `running += 4` 會錯；要先減掉舊值再加新值，或重新計算。變形三：題目改問「最近 3 筆的總和」，你要用 deque 在新增時也移除最舊值，不能繼續永遠累加。

**紙筆練習：** 初始 `running=0`，收到 `(id1,5)`、`(id2,2)`、`(id1,5)`，題目明確要求重複 ID 不重算。正確答案應依序為 5、7、7；若你得到 12，說明只實作加總，忘了事件唯一性規則。

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`stream_event_dedup.py`），與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。直接以 Python 3 執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```python
from random import Random

def process(events):
    seen=set(); total=0;states=[]
    for key,value in events:
        if key not in seen:
            seen.add(key)
            total += value
        states.append(total)
    return states

assert process([(1,5),(2,2),(1,5)]) == [5,7,7]
rng=Random(2026)
for _ in range(1000):
    events=[(rng.randrange(12),rng.randrange(-5,6)) for i in range(rng.randrange(50))]
    expected=[];first={}
    for k,v in events:
        first.setdefault(k,v)
        expected.append(sum(first.values()))
    assert process(events)==expected
print('event duplicate semantics PASS')
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。
