---
id: ros2-21-official-demo
title: 2-1 ROS 2 Jazzy：官方 Demo 操作與除錯
category: ROS 2
tags: ros2, jazzy, node, topic, publisher, subscriber, cli, docker
aliases: ROS 2 基礎, node topic, section2-1, 官方演練, /number /double, topic 無資料
difficulty: beginner
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/
verified: true
updated_at: 2026-11-10
summary: 成大 116 特殊選才官方 2-1 演練重點：以 CLI 觀察 node/topic、驗證訊息及排查資料流。
related: ros2-21-optimization-options
---

## 來源與範圍

依據成大資工 116 學年度《上機考試演練試題》「壹、一、以 ros2 CLI 觀察 ROS 2 節點與話題」整理；原始練習檔案位於官方 demo/section2-1/。**官方明確說明：演練是背景練習，不是正式考題，也不涉及真正考題演算法。** 本篇為學習筆記，不代表考試必考內容。

ROS 2 版本是 Jazzy。**官方 2-1 的主要目標是看懂並觀察通訊系統，遇到沒有資料時用 CLI 定位問題。**

## 基本概念

- **Node**：參與 ROS 2 通訊的執行單位，例如 /publisher 與 /processor。
- **Topic**：以名稱及固定 message type 區分的非同步資料通道，例如 /number 與 /double。
- **Publisher**：將訊息發到 Topic。
- **Subscriber**：訂閱 Topic，接收訊息。
- **Callback**：收到訊息後由執行器安排呼叫的處理函式。
- **Topic / Service / Action**：Topic 適合持續非同步訊息；Service 適合請求與回覆；Action 適合較長、可追蹤進度的工作。**Demo 實際只操作 Topic。**

官方資料流：

~~~text
/publisher -> /number (std_msgs/msg/Int32) -> /processor -> /double (std_msgs/msg/Int32)
~~~

publisher 約每秒發出一個隨機整數；processor 收到後乘以 2，再發布到 /double。

## Docker 啟動方式

在官方 demo/ 根目錄：

~~~bash
docker build -t srecruit-demo .
docker run --rm -it --name srecruit-demo srecruit-demo
~~~

在第一個容器 Shell 執行：

~~~bash
cd section2-1
~~~

另外開兩個終端機，進入**同一個正在執行的容器**：

~~~bash
docker exec -it srecruit-demo bash
cd section2-1
~~~

原本有 3 個終端機，是因為 publisher、processor、topic echo 會持續執行，方便同時觀察；不是需要 3 個 Docker 容器。

## 官方重要指令速查

| 指令 | 觀察重點 |
| --- | --- |
| \`ros2 node list\` | 目前可發現哪些 node |
| \`ros2 node info /publisher\` | node 發布／訂閱的 topic |
| \`ros2 topic list\` | 目前有哪些 topic |
| \`ros2 topic list -t\` | 一起列出 topic 的 message type |
| \`ros2 topic info /number\` | 型別與 Publisher／Subscriber 數量 |
| \`ros2 interface show std_msgs/msg/Int32\` | 訊息欄位，應有 int32 data |
| \`ros2 topic echo /number\` | 實際觀察收到的資料 |
| \`ros2 topic echo /double\` | 觀察 processor 的輸出 |
| \`ros2 topic hz /number\` | 觀察訊息到達頻率，官方範例約 1 Hz |
| \`ros2 topic pub --once /number std_msgs/msg/Int32 "{data: 21}"\` | 手動送入 21，期待 /double 顯示 42 |

提醒：\`ros2 topic echo\` 是透過臨時訂閱者接收資料；\`ros2 topic pub\` 是臨時發布者。Topic 名稱存在不表示目前有 Publisher 或資料流。

## 三個終端機的操作順序

1. 終端機 A：\`python3 publisher.py\`。
2. 終端機 B：用 \`ros2 node list\`、\`ros2 topic info /number\`、\`ros2 topic echo /number\` 和 \`ros2 topic hz /number\` 觀察。
3. 在 A 停止 publisher，再查 node list，確認 /publisher 消失。
4. 終端機 A 重啟 \`python3 publisher.py\`；B 執行 \`python3 processor.py\`；C 執行 \`ros2 topic echo /double\`。
5. 在 A 停止 publisher，保留 B 與 C；執行下面的指令：

~~~bash
ros2 topic pub --once /number std_msgs/msg/Int32 "{data: 21}"
~~~

6. 預期 C 顯示 \`data: 42\`。若未出現，先檢查 Topic 與節點狀態、型別及是否有匹配的 Publisher／Subscriber。

## 訊息不通時，按照資料流找問題

官方建議的排查順序：

1. **Node 是否存在**：\`ros2 node list\`
2. **Topic 是否存在**：\`ros2 topic list -t\`
3. **兩端的 Topic 名稱是否一致**：\`ros2 node info /publisher\`、\`ros2 node info /processor\`
4. **Publisher／Subscriber 數量是否合理**：\`ros2 topic info /number\`
5. **是否真的有資料**：\`ros2 topic echo /number\`、\`ros2 topic hz /number\`

例如 publisher 發往 /number，但 processor 誤訂閱 /numbers：程式可能沒有報錯，但兩者是不同 Topic，不會自動相連。

如果名稱與數量正常卻沒有收到訊息，接著檢查型別、QoS 相容性及執行環境；這些屬於**延伸排查**，不是官方演練要求全部掌握的項目。

## 考場查找與提供 LLM 的內容

遇到「程式沒報錯但沒有資料」時，可以把以下資訊一併給 LLM：

~~~text
ROS 2 Jazzy troubleshooting context:
1. List nodes: ros2 node list
2. List topics and types: ros2 topic list -t
3. Inspect publisher and subscriber nodes: ros2 node info <node>
4. Inspect publisher/subscriber counts: ros2 topic info <topic>
5. Inspect message schema: ros2 interface show <type>
6. Observe actual messages and frequency: ros2 topic echo <topic>, ros2 topic hz <topic>
Check exact topic names, compatible message types and QoS, and whether publishers are actually active. Diagnose the first broken link in the data path; do not assume the callback algorithm is wrong.
~~~

## 參考

- 成大 116 學年度上機考演練文件：使用者提供的官方 PDF；對應 demo/section2-1/（本篇以該文件為主要依據）。
- [ROS 2 Jazzy 官方文件](https://docs.ros.org/en/jazzy/)
- [ROS 2 Topic 教學](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html)
