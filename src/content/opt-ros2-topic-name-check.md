---
id: opt-ros2-topic-name-check
title: ROS 2 Topic 名稱：先查絕對路徑、Domain 與 Type
category: ROS 2
tags: ROS 2, topic, namespace, domain id, QoS
aliases: opt-ros2-topic-name-check, ROS 2 Topic 名稱
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Basic/About-Discovery.html
verified: false
updated_at: 2026-11-13
summary: 名稱對不上先查完整 topic 路徑、ROS_DOMAIN_ID、訊息型別，不要立刻改 QoS。
related: ncku-ros2-cli-workflow
---

# topic 名稱一樣「看起來」一樣，不一定是同一個通道

遇到 Subscriber 沒收到資料，先從 CLI 看**完整名稱**、型別、端點數量，再看 QoS。ROS 2 的相對名稱可能受 node namespace 影響，例如 `chatter` 在 namespace `/robot1` 下可能解析成 `/robot1/chatter`；而 `/chatter` 是絕對名稱。

## 在已 source 的 ROS 2 環境查（需要兩個 Terminal 時各自 source）

```bash
printenv ROS_DISTRO
printenv ROS_DOMAIN_ID
ros2 node list
ros2 topic list -t
ros2 topic info /chatter -v
ros2 topic echo /chatter
```

這些命令只是診斷模板：`/chatter` 必須換成你實際看到的 topic。若目前的 shell 沒有 ROS 設定，不要把 `ros2 command not found` 當成通訊錯誤；先檢查是否 `source /opt/ros/jazzy/setup.bash` 及專案 overlay。

## 判讀順序

1. **發現不到 Node**：確認 Node 是否執行、是否在同一個 `ROS_DOMAIN_ID`、相同 RMW 與網路發現條件。單一容器／多個終端機也要核對環境變數；不應任意改考場設定。
2. **有 Node 但 Topic 不同**：透過 `ros2 node info /actual_node` 對照 Publisher/Subscriber 使用的實際名稱，核對 namespace 和 remap。
3. **Topic 同但 type 不同**：先修 message type，調 QoS 沒用。
4. **名稱、型別一致但收不到**：`ros2 topic info -v` 查 Publisher/Subscriber QoS 的 Reliability、Durability 等相容性。

`ros2 topic list` 只代表 ROS graph 裡看得到名稱，不代表資料已流到 Subscriber；`ros2 topic echo` 自己也會建立一個新的訂閱端，不能代替應用程式內部的正確性檢驗。

**驗收**：確認 Publisher 實際發布至少一筆可識別的測試訊息，Subscriber 收到相同 type 與值，並記錄送達數量／頻率。若名稱或 Domain 不對先修這部分，不要將調 depth 誤認成連線修復。
