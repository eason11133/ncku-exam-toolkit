---
id: opt-perf-batch-max-wait
title: 批次若等不滿，必須有最大等待時間
category: Performance Engineering
tags: Performance Engineering, perf-batch-vs-realtime, 考場判讀
aliases: opt-perf-batch-max-wait, 批次若等不滿，必須有最大等待時間
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-13
summary: 只靠滿 N 筆才 flush 可能讓最後幾筆永久滯留。
related: ncku-v2-perf-batch-vs-realtime
---

# 批次若等不滿，必須有最大等待時間

## 錯在哪

設 `batch_size=16`，如果最後只收到 3 筆而再也沒有新資料，單靠「滿 16 筆才送」會讓這 3 筆永遠不處理。要加一個以 monotonic clock 追蹤的最大等待期限，shutdown 時也要 flush；如果題目不允許延後，甚至不該 batch。

## 純 Python 離散事件模擬（非實際 Timer）

<!-- test: full-python -->
```python
queue=[]; outputs=[]; first_at=None
limit=3; max_wait=5
def receive(t, value):
    global first_at
    if not queue: first_at=t
    queue.append(value)
    if len(queue)>=limit: flush()
def flush():
    global first_at
    if queue:
        outputs.extend(queue); queue.clear(); first_at=None
def tick(t):
    if queue and t-first_at>=max_wait: flush()
receive(0,"A"); receive(1,"B"); tick(4)
assert outputs == []
tick(5)
assert outputs == ["A","B"]
receive(6,"C"); flush() # 模擬 shutdown
assert outputs == ["A","B","C"]
print(outputs)
```

真實系統要考慮 timestamp 取樣點、Timer 排程抖動與鎖；如果 producer/consumer 不同 Thread，`queue` 和 `first_at` 必須同步。**不能拿這段模擬的時間當成 ROS 2 Timer 實測延遲。**

**驗收**：最後一筆、低流量、突然停流、shutdown、Timer 延後執行及最大批次剛滿時，確保資料不遺失也不重複。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/time.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：Batch 為什麼需要「容量」和「截止時間」

假設每筆工作平均 3ms，合併 8 筆可以減少每次啟動的固定成本。但流量突然很低時，若你永遠等到湊滿 8 筆才處理，最後那一筆可能**永遠送不出去**。因此常見規則是「滿 8 筆，或最早那筆等待達到 20ms，就發一批」，兩個條件誰先到就觸發。

例子：工作到達時間 0、5、9ms；20ms 時仍只有 3 筆，就必須送出；不能在 9ms 新工作到達時把截止時間重設成 29ms。否則持續零星進來的工作會讓第一筆無止境延後。

**不能只算 throughput：** 記每筆 `arrival_at`、`batch_start`、`done_at`，延遲是 `done_at-arrival_at`；除了平均值，還要比較 p95 與最大值。要求即時回應的題目可能寧可少一點吞吐量也不能有長尾等待。實際效能要用真正的工作量測，這個模型只是在教決策規則。
