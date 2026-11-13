---
id: opt-perf-adaptive-batch-cap
title: 自適應批次一定要有容量與延遲上限
category: Performance Engineering
tags: Performance Engineering, perf-batch-vs-realtime, 考場判讀
aliases: opt-perf-adaptive-batch-cap, 自適應批次一定要有容量與延遲上限
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-13
summary: 批次可以按負載調整，但保留最大容量、等待期限及正確性。
related: ncku-v2-perf-batch-vs-realtime
---

# 自適應批次一定要有容量與延遲上限

## 何時需要

高流量時大批次省下固定成本；低流量時應縮小批次、降低等待。自適應不代表每秒變一次大小就會更快，頻繁調整還可能造成抖動。必須有保守上限與回退策略。

## 純 Python：從觀察值決定批量上限

<!-- test: full-python -->
```python
MIN_SIZE, MAX_SIZE = 1, 16
def choose_batch(backlog):
    if backlog <= 0: return MIN_SIZE
    target=backlog // 2 + 1
    return max(MIN_SIZE,min(MAX_SIZE,target))
assert choose_batch(0)==1
assert choose_batch(6)==4
assert choose_batch(1000)==16
print([choose_batch(x) for x in [0,2,6,32]])
```

這只是明確有上下限的**策略函式**，不代表經測試的最佳控制器。真實系統還要獨立保證每筆最大等待時間；不能只因 backlog=0 就推定 `flush` 不需要執行。

## 安全的決策

先用固定 batch 版作為 baseline。測相同負載序列的成功筆數、queue backlog、p50/p95、記憶體與 CPU，再決定是否保留自適應。若不能丟資料，過載時要有背壓或可恢復的拒收機制。此方案沒有通用的最佳數字，不能直接把 16 當成考場最佳批量。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/time.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 深讀延伸｜把原理放進真實情境
## 自適應批次的陷阱：最後幾筆永遠湊不滿

假設 `batch_max=8`、來源突然只來 3 筆後停止。如果你的程序只有 `len(queue)==8` 才處理，這三筆會**永久留在 Queue**，即使 CPU 很閒也不會完成。這是功能錯誤，不是小小的延遲變化。

要把批次流程想成三個事件：1. 到達 8 筆就送出；2. 最早一筆的等待時間超過上限就送出；3. 正常關閉時必須 flush 剩下的資料。若 Queue 有容量上限，滿載時也必須定義是阻塞 Producer、回報錯誤還是允許丟棄，不能沉默丟掉必要的資料。

例如第一筆在 0 ms、第二筆 6 ms、第三筆 9 ms 抵達，設定最多等 10 ms。即使沒湊到 8 筆，最遲也應在第一筆的 deadline 觸發；不能每收到新資料就把期限重新設定成 `now+10`，否則來源持續稀疏進入時可能一直延期。

量測要同時記錄吞吐量、每筆端到端延遲 p50/p95、工作完成總數與順序。自適應演算法可能在高負載下切大 Batch，但實際上是否較快，必須和固定 Batch 的可重播負載比對。

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`batch_deadline_model.py`），與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。直接以 Python 3 執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```python
# A deterministic *algorithmic model*, not an OS timer or ROS 2 test.
from dataclasses import dataclass
@dataclass(frozen=True)
class Event:
    at: int
    value: int

def simulate(events, limit, max_wait):
    if limit <= 0 or max_wait <= 0:
        raise ValueError('positive limit and deadline required')
    pending=[]; flushed=[]; start=None
    for e in events:
        if start is not None and e.at-start >= max_wait:
            flushed.append((start+max_wait, tuple(pending)))
            pending=[];start=None
        if start is None:start=e.at
        pending.append(e.value)
        if len(pending)==limit:
            flushed.append((e.at,tuple(pending)))
            pending=[];start=None
    if pending:flushed.append((start+max_wait,tuple(pending)))
    return flushed

inp=[Event(0,1),Event(6,2),Event(9,3)]
assert simulate(inp,8,10)==[(10,(1,2,3))]
assert simulate([Event(i,i) for i in range(9)],4,100)==[(3,(0,1,2,3)),(7,(4,5,6,7)),(108,(8,))]
for count in range(20):
    out=simulate([Event(i*4,i) for i in range(count)],3,7)
    assert [x for _,batch in out for x in batch]==list(range(count))
print('batch order / last flush / max wait model PASS')
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。
