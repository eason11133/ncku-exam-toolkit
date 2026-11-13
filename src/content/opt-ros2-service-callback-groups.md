---
id: opt-ros2-service-callback-groups
title: ROS 2 Service 卡住時，檢查 Callback Group 和 Executor
category: ROS 2
tags: ROS 2, ros2-service-client-deadlock, 考場判讀
aliases: opt-ros2-service-callback-groups, ROS 2 Service 卡住時，檢查 Callback Group 和 Executor
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html
verified: false
updated_at: 2026-11-13
summary: MultiThreadedExecutor 本身不能保證同步等待不會死鎖。
related: ncku-v2-ros2-service-client-deadlock
---

# ROS 2 Service 卡住時，檢查 Callback Group 和 Executor

## 典型狀況

某個 timer callback 同步等 service response，而處理 response 所需的 callback 無法取得 executor 的執行機會，便可能一直卡住。即使改成 MultiThreadedExecutor，如果兩段工作被同一個 `MutuallyExclusiveCallbackGroup` 限制，也未必能重疊。分開 group 仍必須考慮共享資料同步。

## rclpy Node 概念片段（不保證可獨立執行）

```python
from rclpy.callback_groups import MutuallyExclusiveCallbackGroup
from rclpy.executors import MultiThreadedExecutor

# 放進 Node 初始化：
self.timer_group = MutuallyExclusiveCallbackGroup()
self.client_group = MutuallyExclusiveCallbackGroup()
# self.create_timer(..., self.on_timer, callback_group=self.timer_group)
# self.create_client(ServiceType, '/service', callback_group=self.client_group)
# 建立 executor = MultiThreadedExecutor(num_threads=2) 並加入 node
```

**優先用 `call_async` 而非在 callback 裡同步等結果**，尤其在單執行緒 executor。這段沒有完整 Node、ServiceType、request 或 spin，不能直接複製當成完整考題答案。

**驗收**：記下每個 callback/Client/Server 所在 group、executor thread 數、是否有同步等待；加入 timeout，觀察 response callback 是否真的執行。避免為了解決死鎖就盲目設成 `ReentrantCallbackGroup` 而新增 Data Race。

## 來源與驗證界線

- 參考：https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html
- 完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 為什麼換成 MultiThreadedExecutor 還是可能卡住？

假設 Callback A 收到請求後，用同步方式等待 Service 回覆；但是 Service 的回覆也需要 executor 安排另一個 Callback 才能被處理。如果兩個 Callback 被放進同一個 **MutuallyExclusiveCallbackGroup**，A 一直佔著群組不放，另一個 Callback 沒機會開始，就可能互相等下去。

這不代表「只要改成 MultiThreadedExecutor 就一定會好」。Executor 有多個工作執行緒，Callback Group 的互斥限制仍然存在。你必須同時確認：

- 兩個需要重疊的 Callback 是否被安排在允許重疊的群組。
- Node 是否有保留 Callback Group 物件的參照。
- 如果允許重疊，共享變數與輸出順序有沒有另外保護。

### 先選比較好驗證的做法

如果 Service 不要求立刻拿到結果，先用 `call_async()` 取得 Future，再用完成 Callback 處理結果。這讓原先的 Callback 可以較早返回，不必一直占住 Executor。可是若你立刻在 Callback 裡呼叫 `future.result()` **阻塞等待**，就又把非同步改回等待了。

### 小情境練習

A 要呼叫 Service B，B 可能要 50 ms 回覆。題目規定 A 收到資料後還有其他訊息要繼續接收。哪一種設計比較合理？讓 A 直接同步等 50 ms、還是發出 async request 再在結果到時處理？第二種通常比較容易避免阻塞。但如果 B 回覆後必須按原訊息順序輸出，就要保留 request ID，必要時重排；不能把「async」理解成「順序不用管」。

這裡的流程是概念推理，**並未在 Jazzy 實機驗證**。到考場時應檢查你的 callback group 配置、executor thread 數、Future 完成條件及錯誤回傳路徑。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：不是換成 MultiThreadedExecutor 就不會死鎖

有個 Timer Callback 每秒呼叫一次 Service，並**同步等待回覆**。如果 Timer 和 Service Client 的完成回呼都被放在**同一個 Mutually Exclusive Callback Group**，等待中的 Timer 佔著該 Group；完成回呼又必須進入這個 Group 才能讓等待結束。兩邊互相等，就形成死鎖。

把 Executor 開成多執行緒仍可能沒有用，因為「有多個 Worker」不代表同一個 Mutually Exclusive Group 的兩個 Callback 可以並行。ROS 2 預設 Callback Group 就是 Mutually Exclusive，所以**只改 Executor 參數**往往不是完整修正。

| 改法 | 要確認的事 |
|---|---|
| 改成 `call_async`，在完成回呼取結果 | 呼叫後不要在**同一個 Callback**立即同步阻塞等 Future；要處理失敗、逾時和停止 |
| Timer 與 Client 使用不同 Callback Group | Executor 有足夠工作執行緒，相關狀態仍須同步，且 Group 物件需持續存活 |
| 使用 Reentrant Group | 允許重入**不代表資料自動安全**；Callback 可能同時修改相同資料 |

**檢查順序：** 先印出進入 Timer、發出 Request、收到完成回呼的事件順序。若每次都卡在「發出 Request 後」，要分別查 Service Server 是否回覆，以及 Client 的完成回呼是否被自己佔住的 Group 擋住。這個案例根據 ROS 2 官方 Callback Groups 文件；本包未在 Jazzy 實際執行。
