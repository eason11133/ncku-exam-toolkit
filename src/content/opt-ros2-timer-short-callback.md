---
id: opt-ros2-timer-short-callback
title: ROS 2 Timer 變慢：先減少 Callback 裡的阻塞
category: ROS 2
tags: ROS 2, ros2-timer-jitter, 考場排查, 實作條件
aliases: opt-ros2-timer-short-callback, ROS 2 Timer 變慢：先減少 Callback 裡的阻塞
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html
verified: false
updated_at: 2026-11-13
summary: timer callback 若執行太久會拖慢同 Executor 的其他工作；先定位耗時而不是亂調頻率。
related: ncku-v2-ros2-timer-jitter
---

# 設定 20 Hz，不等於一定每 50 ms 準時完成

**症狀**：設定 `create_timer(0.05, ...)`，實際輸出卻一陣快一陣慢，或其他 Topic 訂閱也被拖住。先找 timer callback 是否在做同步 I/O、大量排序、重複解析設定，或每次把 Log 印到終端機。

## rclpy 節點內片段：把固定資料移出 Callback

```python
# 必須放在 rclpy Node 類別內；不是完整可獨立執行程式。
# __init__：初始化固定設定，保存 Timer 參照
self.threshold = parse_threshold_from_config(config_text)
self.timer = self.create_timer(0.05, self.on_tick)

# on_tick：只做每次真正必要的事
def on_tick(self):
    msg = make_next_message(self.threshold)
    self.publisher.publish(msg)
```

`parse_threshold_from_config` 和 `make_next_message` 是你的專案函式，須自行實作。若設定會改動，還要在參數變更點更新 `threshold`，不能無限沿用舊值。Publisher 的送出時間不等於接收端的完成時間。

## 量出延遲，而不是猜

以 `time.perf_counter()` 量 callback 內的 parse／compute／publish 段落；收集多次樣本並另看計時器的實際觸發間隔。這是不同指標：**callback 耗時**、**排程延後**、**端到端訊息延遲**不能混為一談。測效能時減少逐筆日誌以免改變排程。

**驗收**：同一輸入序列比對修改前後發布筆數、數值與時間戳，再看 timer 間隔分布和 p95；確認必需的狀態更新沒有被移到錯誤時機。此例只核對 API 寫法和設計，沒有在 ROS 2 Jazzy 容器裡執行。
## 深讀延伸｜把原理放進真實情境
## 50 ms 的 Timer 為什麼不一定每 50 ms 回來一次？

假設你設定 20 Hz，也就是每 50 ms 排定一次觸發；但 callback 每次需要 80 ms 才能完成。單執行緒 Executor 不能同時執行兩個 callback；下一次回呼即使「時間到了」，也可能要等前一次結束。**Timer 不是硬體保證的準時中斷**。

先辨別 callback 慢在哪裡：序列化、讀檔、等待另一個 Service、反覆 `json.loads`，還是純 CPU 計算。固定不變的設定可考慮在初始化時計算一次，但有更新需求的資料不能無條件快取。把 callback 換到 MultiThreadedExecutor 也不是免費加速，還要看 Callback Group 是否允許重疊、是否有共享狀態和 Python GIL 的限制。

**手動推演：** 第一次在 0 ms 開始、80 ms 結束；第二次理想排程是 50 ms，但若同 Executor 只有一條執行緒，它不可能在 50 ms 同時開始執行。量測時記錄**實際開始時刻**和**完成時刻**，不要只列 `timer_period=0.05` 就宣稱穩定 20 Hz。

若 callback 裡同步等待 Service，還可能造成 Executor 無法執行回覆 callback 而互相等待。要先分清是「慢」還是「死鎖」，再選擇非同步呼叫或正確的執行器設定。
