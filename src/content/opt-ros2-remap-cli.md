---
id: opt-ros2-remap-cli
title: ROS 2 Remapping：不用改原始碼也能改 Topic 名稱
category: ROS 2
tags: ROS 2, remapping, namespace, node arguments
aliases: opt-ros2-remap-cli, ROS 2 Remapping
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://design.ros2.org/articles/ros_command_line_arguments.html
verified: false
updated_at: 2026-11-13
summary: 使用 --ros-args -r old:=new 時，先辨別絕對／相對名稱並驗證 CLI 的完整路徑。
related: ncku-v2-ros2-remap-diagnostics
---

# 不要為了 Topic 名稱不一致就重寫 Publisher

ROS 2 的靜態 remap 可以在啟動 Node 時改 topic 名稱；但 remap 只套在該進程或指定 node 的名稱解析規則上，**不是讓系統中所有 Node 自動改名**。

## 使用 ROS 2 Jazzy 官方 demo package 的操作範例

```bash
# Terminal A：如果 demo_nodes_cpp 已安裝
ros2 run demo_nodes_cpp talker --ros-args -r chatter:=/demo/chatter
# Terminal B：如果 demo_nodes_py 已安裝
ros2 run demo_nodes_py listener --ros-args -r chatter:=/demo/chatter
# Terminal C：查看解析後的名稱
ros2 topic list -t
ros2 topic info /demo/chatter -v
ros2 topic echo /demo/chatter
```

這是已確認的 ROS 2 CLI 語法，但**尚未在這份離線環境跑 ROS 2**。`demo_nodes_cpp` 和 `demo_nodes_py` 可能未包含在考場提供的環境，不能假設它們一定安裝；操作原專案時請換成實際 package、executable、topic 名稱。

## 三個重要差異

`chatter:=/demo/chatter` 左側是原 Node 使用的**相對名稱**，右側是新的絕對 topic。若原程式寫的是 `/absolute_topic`，相對 remap 不一定能匹配；需根據原始命名規則修改。

`__node:=new_name` 是改 Node 名稱，`__ns:=/robot1` 是改 namespace，這兩者和改 Topic 不同。若 executable 裡啟動多個 Node，未加 node-specific 規則可能套到超過你預期的 Node，應查 ROS 2 node arguments 規範。

## 測試之前別急著改

先記下原本 `ros2 node info` 與 `ros2 topic list -t` 的輸出。改完驗證發布端與訂閱端**解析後的名稱相同**，再看訊息 type、QoS、內容。若只有一端 remap 了另一端沒改，仍可能完全收不到資料。Remap 也不能修正本來的 C/Python callback 錯誤或封包解析錯誤。

## 驗收範圍與限制

在可用的 ROS 2 Jazzy 環境驗證兩端 remap 後的完整 topic、type、QoS 與訊息內容。離線檢查只驗證指令語法，不代表訊息實際可達。
