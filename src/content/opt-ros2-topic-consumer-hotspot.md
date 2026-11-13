---
id: opt-ros2-topic-consumer-hotspot
title: Topic 堆積：先量 Subscriber 哪一段處理太久
category: ROS 2
tags: ROS 2, ros2-topic-backlog, 考場排查, 實作條件
aliases: opt-ros2-topic-consumer-hotspot, Topic 堆積：先量 Subscriber 哪一段處理太久
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html
verified: false
updated_at: 2026-11-13
summary: 使用分段計時找真正昂貴的工作，維持輸出值、順序與筆數。
related: ncku-v2-ros2-topic-backlog
---

# Queue 變長是結果，先找為什麼消費太慢

**症狀**：Publisher 原本穩定，但 Subscriber 輸出愈來愈晚。請先區分：資料尚未收到、已收到卻在 callback 計算、publish 花時間，還是其他 callback 將 Executor 卡住。

## rclpy Callback 內計時片段

```python
from time import perf_counter

def on_msg(self, msg):
    t0 = perf_counter()
    parsed = parse_message(msg)
    t1 = perf_counter()
    result = calculate(parsed)
    t2 = perf_counter()
    self.pub.publish(to_ros_message(result))
    t3 = perf_counter()
    # 先累計到固定大小測量陣列；不要每筆 log。
    self.samples.append((t1-t0, t2-t1, t3-t2))
```

這是整合片段，`parse_message`、`calculate`、`to_ros_message`、`self.samples` 需在實際 Node 中提供。若 `samples` 無上限增加也會造成新問題，請使用有界 Queue／固定容量環形緩衝或批次匯總。

## 優化前先測正確性

用相同輸入序號，確認每筆輸出是否必須保留；若需要完整輸出，**不能用只處理最後一筆**取代原程式。若 `calculate` 是主要成本，優先選可證明等價的演算法；若慢在同步 I/O，考慮移到別的工作者但要保留背壓與順序。ROS 2 的 Executor 不會因多 Thread 自動使 GIL 下純 Python 工作獲得多核心加速。

**驗收**：固定訊息輸入速率，記錄每段耗時（中位數、p95）、收到與完成的序號、CPU、RSS。改完再比端到端延遲。這份文字沒有在 ROS 2 Jazzy 實際跑 Node。

## 延伸推演｜遇到變形題怎麼判斷

## 收到 100 Hz，不等於處理得完 100 Hz

Publisher 每 10 ms 送一筆資料，Subscriber 的 callback 卻平均花 15 ms。即使名字、型別、QoS 完全相容，Consumer 也可能跟不上。加大 Queue 只是讓資料晚點處理；如果生產速度長期高於消費速度，延遲和積壓問題仍會存在。

先分段測：接收、解析、計算、發布回覆各花多少時間。若慢的是把同樣的設定每筆都重新 JSON 解析，可在明確不變的前提下快取；若慢的是需要大量純 CPU 計算，可能要改演算法或管線設計。不要直接換 MultiThreadedExecutor 就以為 Python 的 CPU-bound 函式能平行加速，還受 Callback Group、共享資料與 GIL 影響。

驗收要留每筆 ID 或 sequence，比對收到、完成、捨棄的數量。只拿 `ros2 topic hz` 的收訊頻率當成功證明，無法看出內部 callback 是否完整處理了全部資料。
