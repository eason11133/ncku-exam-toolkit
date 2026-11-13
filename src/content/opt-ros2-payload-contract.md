---
id: opt-ros2-payload-contract
title: ROS 2 訊息減量之前，先查誰在讀欄位
category: ROS 2
tags: ROS 2, ros2-message-serialization, 考場判讀
aliases: opt-ros2-payload-contract, ROS 2 訊息減量之前，先查誰在讀欄位
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Tutorials/Demos/Intra-Process-Communication.html
verified: false
updated_at: 2026-11-13
summary: 減少 payload 會改介面；先盤點 subscriber 與 message type。
related: ncku-v2-ros2-message-serialization
---

# ROS 2 訊息減量之前，先查誰在讀欄位

## 先弄清楚協定

如果 Publisher 發出大型影像，但下游只有人要平均亮度，可新增摘要 Topic 讓需要的人只訂閱小消息。**不能直接刪掉既有 ROS message type 的某個欄位**，然後假定全部 Subscriber 還能相容；其他 Node 可能需要原始影像。

```text
Before: /camera/image_raw -> A(image process), B(average only)
After : /camera/image_raw -> A(image process)
        /camera/mean      -> B(average only)
```

這是架構示意，不是經測試的 rclpy 程式。若同時有多個 Subscriber，發兩個 Topic 也可能增加總工作量，因此先測真的瓶頸在哪。

## 修正前要記錄

- 原 message type、每筆 bytes、發布/接收頻率；哪些接收者需要哪些欄位。
- 允許丟失中間狀態嗎？如果不允許，不得只用改小 QoS depth 讓延遲看似變好。
- 新舊 Topic 需要並存多久？故障時如何回退？

**驗收**：用相同輸入逐筆比對 A 的原始結果與 B 的摘要值，記錄每秒吞吐、CPU、RSS、p95、掉訊息數。沒有量測，不宣稱改成摘要一定更快。

## 來源與驗證界線

- 參考：https://docs.ros.org/en/jazzy/Tutorials/Demos/Intra-Process-Communication.html
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 深讀延伸｜把原理放進真實情境
## 刪欄位前，先想誰還需要這份資料

假設 Publisher 原本發布 `{stamp, x, y, image}`，A 訂閱者只算 `x+y`，B 訂閱者卻會存整張 `image`。你觀察 A 很慢，就把 `image` 刪掉：A 可能變快，B 的功能卻直接壞了。這不是優化成功，因為你偷偷改了資料契約。

先畫出 Publisher → Topic → 所有 Subscriber，列出每個消費端讀哪些欄位。接著看**訊息型別**：ROS 2 訊息不像 Python dict 任意刪 key，改 `.msg` 定義會影響介面相容性，需要相容的建置與部署。如果沒辦法同時改所有消費端，可評估另開精簡 topic 或在單一接收端內先避免不必要的資料轉換。

要量測時，除了 bytes/message，至少檢查所有 Subscriber 收到的欄位值、收到的訊息數和處理結果。若原本每秒 100 筆，改成每秒 10 筆，總 CPU 下降不代表「每筆解碼更快」。要固定工作量，才知道改善來自格式、頻率還是跳過工作。

**練習問自己：** 收端本來需要時間戳判斷資料是否過期。為了省 8 bytes 刪掉時間戳會怎樣？可能無法再識別舊資料；這是一個不該為了速度刪的欄位。
