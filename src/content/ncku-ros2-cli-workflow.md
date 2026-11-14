---
id: ncku-ros2-cli-workflow
title: ROS 2 Jazzy：從 Topic 資料流到 CLI 排查
category: ROS 2
tags: ROS 2, node, topic, publisher, subscriber, Jazzy, CLI
aliases: ros2 topic, ros2 node, rclpy, 訊息傳輸
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html
verified: false
updated_at: 2026-11-12
summary: 熟悉官方 2-1 範例，會從 node、topic、message type 和 CLI 訊息一步步定位通訊問題。
related: ncku-ros2-executor, ncku-ros2-qos
---
# ROS 2 資料流與 CLI 排查

## 先看整體

```text
publisher.py（/publisher）
  └─ publish(std_msgs/msg/Int32, /number)
        ↓ ROS 2 Topic /number
processor.py（/processor）
  └─ subscribe(/number) → callback → x2 → publish(/double)
        ↓
ros2 topic echo /double → 觀察結果
```

Node 是執行功能並參與 ROS 通訊的單位，Topic 是持續傳送訊息的通道。Publisher 送出訊息，Subscriber 收到後觸發 Callback。Topic 的 **名稱和 message type 必須一致**，但這兩個條件只是基本檢查；QoS 不相容、節點沒啟動、網路 discovery 或程式執行問題也可能造成收不到訊息。

你做過的官方練習，就是送出 `21`，讓 processor 接收後輸出 `42`。這個例子可用來驗證「整條資料流」是否通暢，不是效能測試。

## 官方練習的基本順序

在已進入 ROS 2 Jazzy 練習容器、所在目錄為 `/demo/section2-1` 時，先啟動 publisher 和 processor（需多個終端機）：

```bash
python3 publisher.py
# 第二個終端機
python3 processor.py
```

第三個終端機使用：

```bash
ros2 node list
ros2 node info /publisher
ros2 node info /processor
ros2 topic list -t
ros2 topic info /number
ros2 interface show std_msgs/msg/Int32
ros2 topic echo /number
ros2 topic echo /double
ros2 topic hz /number
```

如果多個命令分別運行，部分指令會一直監聽，按 `Ctrl+C` 停止後再輸入下一條。

手動發訊息（publisher 是否啟動取決於測試目的）：

```bash
ros2 topic pub --once /number std_msgs/msg/Int32 '{data: 21}'
```

對照 `/double` 是否收到 `data: 42`。CLI 的 topic pub 會建立一個臨時 publisher；若稍縱即逝或 discovery 尚未完成，觀察輸出時要留意時序。

## 故障排查：不要亂改程式

| 現象 | 下一步指令 | 確認什麼 |
|---|---|---|
| `/processor` 不在 node list | `ros2 node list` + 檢查執行視窗 | 程式是否啟動、是否崩潰 |
| publisher 在、processor 不接收 | `ros2 node info /processor` | 訂閱的 Topic 名稱是否一致 |
| Topic 名稱一致仍收不到 | `ros2 topic info /number -v` | Message type、Endpoint QoS 是否相容 |
| 原始訊息有，處理結果沒有 | `ros2 topic echo /number`、`/double` + processor log | Callback 是否出錯或卡住 |
| 偶爾收不到、延遲大 | `ros2 topic hz`、Callback 耗時紀錄 | 發布頻率、阻塞、排隊、傳輸問題 |

一個常見情境：原來訂閱 `/number`，卻被改成 `/numbers`。此時並不是 ROS 2 故障，而是名稱不同。先用 `ros2 node info /processor` 找出目前訂閱的 Topic，再看 `ros2 topic list -t`，就能縮小範圍。

如果 publisher 正常但手動發布能觸發 processor，表示 processor 的輸入路徑可能沒問題，應回頭檢查原 publisher 的內容、型別或 QoS；這是縮小範圍，不是直接證明根因。

### Topic 還在，為什麼卻沒有資料？

在 ROS 2 裡，`ros2 topic list` 看得到某個 Topic，只代表目前的通訊圖裡有人使用或宣告這個名稱，**不代表一定有 Publisher 正在傳資料**。

例如原本有一個 Publisher 負責送資料，另一個 Node 正在訂閱。Publisher 停止後，訂閱者還在，Topic 名稱仍可能留在清單裡。這時 `ros2 topic info /number` 的 Publisher count 可以是 0；Subscriber count 則可能不是 0。`ros2 topic echo /number` 也可能一直等，因為根本沒有人送新資料。

另外，`ros2 topic echo` 自己就是一個 Subscriber，所以執行它之後，訂閱端數量可能增加。要判斷系統是否正常，應該同時看 **Publisher 是否存在、Topic 名稱與型別是否正確，以及有沒有真的收到訊息**。ROS 2 的節點發現也需要一點時間，瞬間的數量變動不必立刻當成程式錯誤。

### 同一個 Topic 可以有兩個 Publisher 嗎？

可以。假設兩個程式都向 `/number` 發送相同訊息型別，`ros2 topic info /number` 在兩個 Publisher 都被發現、仍在執行時，通常會顯示 **Publisher count: 2**。

訂閱 `/number` 的 Node 可以收到兩邊送來的資料，並分別執行自己的 Callback。例如 A 送 10、B 送 21，一個把輸入乘 2 的訂閱端可能分別處理成 20、42。

但**不能保證兩個不同 Publisher 的訊息一定照你想像的先後順序到達**，也不能只看 Publisher count 就保證每筆資料都收到了。還要確認兩邊的 Topic 名稱、Message Type、QoS 能互相配對，並用 `ros2 topic echo` 或應用程式的接收紀錄驗證。

## 對效能問題的第一輪檢查

區分三個時間：訊息產生到接收的**傳輸時間**、Callback 等待被執行的**排隊時間**、Callback 自己花的**執行時間**。`ros2 topic hz` 只能提供觀察到的發布頻率，不能單靠它判斷是哪一段慢。

先在 Callback 開始與結束記錄 `time.perf_counter()`，再考慮使用訊息中來源時間戳（前提是時間基準可比較）估算端到端延遲。不要只以 console `print()` 的頻率作為效能證據，因為輸出本身可能造成阻塞。

**考場 LLM 精簡提問**：

> 這是 ROS 2 Jazzy 專案。請先指出 publisher、subscriber、topic 名稱、message type、QoS、callback 和 spin 的程式位置。我觀察到（貼現象）。先給最短的 CLI 驗證步驟；確認根因後才提出最小修改，並提供修改前後的正確性測試。

## 官方與延伸範圍

官方 2-1 是 CLI 看 node/topic、觀察訊息、發測試訊息，以及故障排查。Executor、QoS、跨節點優化是相關延伸，不代表正式考題會要求這些技術。

參考：[ROS 2 Topics](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html)；[Understanding Nodes](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Nodes/Understanding-ROS2-Nodes.html)。

## ROS 2 Node 看不到時

先確認程式有啟動、兩端使用相同的 `ROS_DOMAIN_ID`、已 source 正確環境，再查容器網路與 DDS Discovery。Bash 可執行 `printenv ROS_DOMAIN_ID`；不同 Domain 不能互相發現，單改 Topic remap 無效。參考：[ROS 2 Domain ID](https://github.com/ros2/ros2_documentation/blob/rolling/source/Get-Started/Configuring-ROS2-Environment.rst)。
