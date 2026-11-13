---
id: opt-ros2-timer-rate-budget
title: 調整 Timer 更新頻率前，先算工作量與資料完整性
category: ROS 2
tags: ROS 2, ros2-timer-jitter, 考場排查, 實作條件
aliases: opt-ros2-timer-rate-budget, 調整 Timer 更新頻率前，先算工作量與資料完整性
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html
verified: false
updated_at: 2026-11-13
summary: 降低頻率會減少工作量，但不能把少做必需工作算成最佳化。
related: ncku-v2-ros2-timer-jitter
---

# 10 Hz 改 5 Hz 看似變快，可能只是工作變少

**適用情況**：輸出是允許降採樣的狀態，例如顯示用的最新溫度，且業務規格允許較慢更新。若每次 timer 代表一筆必須完成的任務、控制命令或累計事件，直接降低頻率會改變功能。

## 先用純 Python 算負載上限

```python
# 可直接執行的算術示範；不是 ROS 2 實際量測。
period_s = 0.05
work_s = 0.03
assert period_s > 0
utilization_of_one_worker = work_s / period_s
print(f"estimated work/period={utilization_of_one_worker:.1%}")
assert abs(utilization_of_one_worker - 0.6) < 1e-12
```

如果每次工作要 30 ms、目標每 50 ms 發一次，單一 Worker 的純計算占用估計約 60%；但這只是排程容量的**粗估**，不含 I/O、DDS、其他 callback、抖動和負載尖峰，不能當實機保證值。長期工作量大於可用時間時，Queue 可能堆積或不斷延後。

## 兩種常見選擇

如果只要最新狀態，可在維持來源事件的情況下使用「保留最新狀態、定期發布」，但要確認最舊可接受延遲與漏掉中間事件是否允許。如果需要每筆工作，改成具背壓的工作 Queue 或縮短每筆計算，不可無聲丟掉。改頻率後要記錄每秒**實際完成數量**而非單看單筆 callback 時間。

**驗收**：原規格要求每秒 20 次還是僅「不超過某更新延遲」？先固定，再對照 10／20 Hz 時的輸出值、總完成筆數、p95、CPU、未處理數和停止時最後事件。沒有外部實測時不能宣稱降頻後效能改善。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 用一個不靠 ROS 的小模擬看「追不上」

假設單一 Worker 每筆資料要做 70ms，但每隔 50ms 就來一筆。20Hz 是發送速率，Worker 的理論處理上限約 14.3 筆／秒；只要持續維持這個情況，排隊的工作會增加。

<!-- v7-test: full-python -->
```python
period_ms, work_ms = 50, 70
next_free = 0
waiting_ms = []
for i in range(5):
    arrival = i * period_ms
    start = max(arrival, next_free)
    waiting_ms.append(start-arrival)
    next_free = start + work_ms
assert waiting_ms == [0, 20, 40, 60, 80]
print('queue wait(ms)=', waiting_ms)
```

這是**單一服務者 FIFO 模型**，不是 ROS 2 Executor 的完整模擬。真實 ROS 2 的 Callback Group、RMW Queue、Timer 排程會更複雜。它只說明一個不能忽略的事：每筆計算若長期慢於資料產生速度，降低顯示更新速率也不能偷偷把必需任務丟掉。

**自己判斷：** 若每筆是必須執行的控制命令，你能用 Keep Last 1 取代 Queue 嗎？不能，因為那會改變任務完成數量。若只是畫面上最新溫度，則可以討論只保留最新狀態。
