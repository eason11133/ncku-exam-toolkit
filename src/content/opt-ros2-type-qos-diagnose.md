---
id: opt-ros2-type-qos-diagnose
title: ROS 2 Topic 已對上仍沒資料：Type 與 QoS 分層排查
category: ROS 2
tags: ROS 2, QoS, reliability, type, debugging
aliases: opt-ros2-type-qos-diagnose, ROS 2 Topic 已對上仍沒資料
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-13
summary: 先核對訊息型別與 Request/Offered QoS，不能只靠增加 depth 或改成 Reliable。
related: ncku-ros2-qos
---

# Topic 有名字卻沒有訊息：名稱、型別與 QoS 不同層

如果兩端的 Node 都存在、完整 Topic 名稱一致，下一步是**訊息型別**與**端點 QoS**。不能因為 echo 沒收到，就直接把 `depth` 從 10 改成 100。depth 通常是佇列保存數量，不會讓本來 Reliability/Durability 不相容的端點神奇配對。

## 指令只做觀察，先不修改程式

```bash
ros2 topic list -t
ros2 topic info /actual_topic -v
ros2 node info /actual_publisher
ros2 node info /actual_subscriber
```

所有 `/actual_*` 都是**占位符**，需換成 `ros2 node list` 與 `ros2 topic list` 真正回傳的名稱，不能直接照貼。`ros2 topic info -v` 可顯示發送與接收端的 QoS profile；不同 Jazzy middleware 的實際顯示會有所差異。

## Request／Offered 不要搞反

以 Reliability 為例：訂閱端要求 Reliable，發布端只提供 Best Effort 時，端點可能不相容；發布端提供 Reliable、訂閱端接受 Best Effort 通常可以配對。Durability 也要對照，例如要求 Transient Local 的訂閱端不能用只提供 Volatile 的發布端滿足要求。

就算相容，也不代表所有訊息都一定送達：還可能有 callback 過慢、Publisher 尚未發送、應用程式邏輯丟掉資料等原因。不同 QoS 模式還會影響延遲、資源與可靠性，應照業務要求決定，不可以只因想讓 CLI 出現訊息就降低需求。

## 驗收

先確保每端使用相同 type；再記錄相容前後的 QoS、實際收到的訊息序號／筆數。若 Topic 根本沒有 Publisher，先修啟動／命名。若 Topic 連接正常但資料舊，才評估 Keep Last depth 和 callback 速度；不要把不同症狀混成一個解法。

## 延伸推演｜遇到變形題怎麼判斷

## 看得到 Topic，為什麼還是一筆都收不到？

ROS 2 節點是否彼此發現、Topic 名稱、Message Type、QoS 是不同的檢查層次。先確認兩端 `ROS_DOMAIN_ID`、實際完整 Topic 名稱；接著用 `ros2 topic list -t` 看型別，再用 `ros2 topic info /topic -v` 看 Publisher/Subscriber 的 QoS。**QoS 不相容時，調高 Queue depth 不保證能解決**，因為兩端可能根本沒有建立可用通訊。

Reliability 有 Request/Offered 的相容性規則，例如 Subscriber 要求 Reliable、Publisher 只提供 Best Effort，通常不相容；反過來 Subscriber 接受 Best Effort、Publisher 提供 Reliable 可以相容。實際還要看 Durability 等其他設定，不能只檢查一個欄位。

`ros2 topic echo` 本身是新的訂閱端，能收到資料不能直接證明你程式裡原來的 Subscriber 也有相容 QoS。驗收應透過目標程式確認同一筆測試資料真的被正確處理。
