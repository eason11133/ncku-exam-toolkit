---
id: opt-ros2-topic-last-state
title: ROS 2 訊息積壓：只要最新狀態時才評估小 Depth
category: ROS 2
tags: ROS 2, ros2-topic-backlog, 考場排查, 實作條件
aliases: opt-ros2-topic-last-state, ROS 2 訊息積壓：只要最新狀態時才評估小 Depth
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-13
summary: Keep Last 的 depth 決定中介層保留筆數；不能用它修可靠性不相容或必須全收的事件流。
related: ncku-v2-ros2-topic-backlog
---

# Topic 名稱、型別、QoS 都相容，資料卻總是很舊

這可能是 Publisher 快於 Subscriber，導致未處理訊息滯留。調小 `depth` 只能影響保留多少尚未處理的樣本；若底層 QoS Reliability／Durability 不相容，根本不會收到，調 depth 沒用。

## rclpy 訂閱端片段（不包含完整 Node）

```python
from rclpy.qos import QoSProfile, HistoryPolicy, ReliabilityPolicy
qos = QoSProfile(
    history=HistoryPolicy.KEEP_LAST,
    depth=1,
    reliability=ReliabilityPolicy.BEST_EFFORT,
)
self.subscription = self.create_subscription(
    SensorMsg, '/sensor', self.on_sensor, qos
)
```

`SensorMsg` 和 callback 由原專案定義。這個例子刻意選 Best Effort，**只能在允許遺失中間狀態且與 Publisher 相容時使用**。Reliable publisher 可以提供給 Best Effort subscriber；Best Effort publisher 無法滿足要求 Reliable 的 subscriber。History 和 depth 的效果還要依 RMW、緩衝與實際負載量測，不能把 depth=1 解讀為絕對「永遠最新」。

## 什麼情況不能套

訂單、操作命令、計數、完整日誌、每筆都要處理的任務不能靠丟舊訊息變快。控制命令即使追求低延遲，也要明訂可靠性及丟棄條件。

**驗收**：使用序號與產生時間比較發布／接收筆數、收到時的資料年齡（age）、最後狀態、p95；先 `ros2 topic info -v` 確認雙端 QoS 相容。這段只依 Jazzy 文件核對，尚未做 DDS 實測。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 用序號確認「只要最新」和「每筆必收」到底差在哪

假設感測器連續發布序號 1、2、3、4、5。畫面只需要最新溫度時，在處理能力不足的情況下跳過舊狀態，可能仍符合需求；但如果每筆代表「付款一次」，跳過任何序號都是資料遺失。

<!-- v7-test: full-python -->
```python
sent = [1, 2, 3, 4, 5]
latest_only = [sent[-1]]
if not (latest_only == [5]):
    raise RuntimeError("example check failed")
if not (len(latest_only) != len(sent)):
    raise RuntimeError("example check failed")
print('latest state:', latest_only, '; lost intermediate events:', len(sent)-len(latest_only))
```

這只是資料保留策略的概念模型，**不是 ROS 2 KeepLast / DDS 的實際測試**。正式排查要拿到 Publisher 發送序號與 Subscriber 接收序號，確認 Reliability、Durability、Depth 以及真正的處理速度。改完後比較的是「資料年齡、到達率、最終狀態、漏件量」，不能只看 Callback 比較快。
## 只有「最新狀態」與「每筆事件都重要」，答案會完全不同

想像溫度感測器一秒送 100 次，而螢幕只能一秒更新 10 次。若螢幕只是顯示**現在溫度**，中間的一些舊資料可能可以捨棄，較小的 Queue depth 能降低讀到舊狀態的機率。可是假如每筆訊息其實是「客戶下了一筆訂單」，把 depth 調成 1 就可能丟掉不可遺失的事件。

用序號觀察：Publisher 發出 `1,2,3,4,5`，Subscriber 只看到 `1,5`。對「最新狀態」畫面可能還能接受；對「每筆要計數」的流程，正確答案應該是處理 5 筆，少了 3 筆就是錯。你必須先問題目要的是**狀態**還是**事件**，再決定 QoS 與 Queue 策略。

### 為什麼只調大 depth 不會讓系統變快？

假設每秒來 100 筆，Callback 每秒只能處理 20 筆，差額每秒是 80 筆。即使 Queue 暫時能多存一些，長時間還是會積壓。容量是讓你有緩衝的空間，不是憑空加速 Consumer。

排查順序：先把收到的訊息加上序號和時間戳，量測端到端延遲，再查 Callback 是否做了昂貴 Logging 或等待。若允許捨棄舊狀態，可討論 Keep Last 與 depth；若不能丟資料，先處理 Consumer 吞吐、背壓或持久化策略。無論哪一種都要比對**資料數量與順序**，不能只因平均延遲變短就宣稱優化成功。
