---
id: ncku-v2-ros2-remap-diagnostics
title: ROS 2 名稱、Namespace、Remapping 排錯
category: ROS 2
tags: ros2, node, topic, namespace, remap, 不通
aliases: ros2,node,topic,namespace,remap,不通
source_type: personal
source_url: https://docs.ros.org/en/jazzy/How-To-Guides/Node-arguments.html
verified: false
updated_at: 2026-11-12
summary: Node 有啟動卻沒有資料，先分辨 topic 名稱、namespace、型別與 QoS 問題。
related: 
priority: P0
difficulty: intermediate
---

# ROS 2 名稱、Namespace、Remapping 排錯

## 遇到什麼情況要查這篇

Node 有啟動卻沒有資料，先分辨 topic 名稱、namespace、型別與 QoS 問題。

## 先理解瓶頸

把 publisher、subscriber 各自使用的完整 topic 名稱列出，不要只看程式中的簡短字串。ROS 名稱可受 namespace 和 remap 影響；相同名稱但不同型別或 QoS 也可能不通。

## 具體修改／排查示例

```bash
ros2 node list
ros2 node info /processor
ros2 topic list -t
ros2 topic info -v /number
ros2 topic echo /number --once
# 必要時：ros2 run PKG NODE --ros-args -r /numbers:=/number
```

## 可以嘗試的方案

### 1. 核對完整 Topic 名稱

**做法**：先查實際對外提供的名稱。

**先檢查**：有不同 namespace 或名稱拼寫。

**可能的代價**：只修名稱不會修 QoS。

**要保留**：topic publisher/subscriber 對上。

### 2. 用 remap 修正連線

**做法**：在不重寫程式碼下更換 topic。

**先檢查**：執行指令能控制 ros-args。

**可能的代價**：執行設定可能分散。

**要保留**：資料仍走到正確消費者。

### 3. 檢查訊息型別與 QoS

**做法**：排除有名稱無連線的原因。

**先檢查**：已確認名稱一致。

**可能的代價**：可能需雙方改 QoS。

**要保留**：不能無條件降低可靠性。

## 具體驗證流程

先用官方 Demo 將 /number 故意改成 /numbers，記錄 CLI 中 publisher、subscriber 的實際名稱；修正後再用 topic echo 和輸出值驗證連接。

## 什麼情況不該用

ros2 topic info -v 的選項依環境版本確認；名稱修正不能代替資料型別及 QoS 檢查。

## 參考與查證狀態

- 參考：[ROS 2 Jazzy remapping](https://docs.ros.org/en/jazzy/How-To-Guides/Node-arguments.html)

## Node 完全看不到時先檢查 Domain

若 `ros2 node list` 看不到預期節點，先確認節點真的啟動、兩端 shell／容器的 `ROS_DOMAIN_ID` 是否一致，以及是否 source 相同 ROS 2 環境。Bash 可用 `printenv ROS_DOMAIN_ID`；未設定時通常使用預設 Domain 0。不同 Domain 的節點不會互相發現，這時改 Topic remap 或 QoS depth 都不能解決。若 Domain 相同仍看不到，再檢查容器網路與 DDS Discovery。來源：[ROS 2 Domain ID](https://github.com/ros2/ros2_documentation/blob/rolling/source/Get-Started/Configuring-ROS2-Environment.rst)。
