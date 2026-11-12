---
id: ncku-ros2-qos
title: ROS 2 QoS：名稱正確仍然收不到訊息
category: ROS 2
tags: QoS, reliability, durability, history, depth, ROS 2
aliases: best effort, reliable, transient local, 訊息丟失
difficulty: intermediate
priority: P1
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-12
summary: 分辨 Topic 不一致與 QoS 不相容，理解降低延遲和丟訊息的取捨。
related: ncku-ros2-cli-workflow
---
# QoS：訊息能不能連上、會不會丟

ROS 2 使用 QoS 指定訊息傳送的要求。即使 Topic 名稱及 Message Type 一樣，也要確認 Publisher、Subscriber 的 QoS 可相容。

## 先認出這些設定

| 設定 | 作用 | 取捨 |
|---|---|---|
| Reliability: Reliable | 盡力重傳，確保可靠交付 | 可能增加等待／流量，不代表完全零遺失 |
| Reliability: Best Effort | 不要求重傳，適合能容忍舊訊息遺失的感測資料 | 網路不穩會丟資料 |
| History: Keep Last + depth | 保留最近 N 筆，可控制佇列容量 | 太小會漏掉中間資料，太大會用更多記憶體 |
| Durability: Volatile | 新訂閱者通常不會收到之前發布的舊資料 | 適合不需回放的更新 |
| Durability: Transient Local | Publisher 留住資料供晚加入者使用（依 QoS 配置） | 需要保存歷史資訊 |

## 排查順序

```bash
ros2 topic info /number -v
ros2 node info /processor
ros2 topic echo /number
```

`-v` 可顯示 endpoint 和 QoS 資訊。先看 Publisher 的 offer 與 Subscriber 的 request 是否兼容，例如 Subscriber 要求 Reliable，但 Publisher 只提供 Best Effort 時可能不相容。不要看到丟資料就直接把佇列調到很大；那可能讓延遲更高。

## 改寫範例

```python
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy

sensor_qos = QoSProfile(
    history=HistoryPolicy.KEEP_LAST,
    depth=5,
    reliability=ReliabilityPolicy.BEST_EFFORT,
)
# Publisher / Subscriber 必須分別傳入相容 QoS；上例並非通用最佳設定。
```

如果考題要求每一筆都不能少，Best Effort 可能不符合功能。若重點是新鮮的最新狀態，允許丟舊資料時，降低隊列長度才有機會降低積壓。

**驗證：** 對同樣的發布速率與網路情況，記錄收到的序號／數量、丟失率、延遲分布，以及 CPU、記憶體。記得先確認「更快」有沒有犧牲正確性需求。

來源：[ROS 2 Jazzy QoS](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)。
