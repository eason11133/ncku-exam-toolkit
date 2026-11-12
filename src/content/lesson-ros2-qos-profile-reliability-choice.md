---
id: lesson-ros2-qos-profile-reliability-choice
title: Reliable 和 Best Effort 取捨
category: ROS 2
tags: QoS, ROS 2 QoS／History／Reliability, 效能優化
aliases: reliability-choice, ros2-qos-profile
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-12
summary: 對感測器狀態可以評估 Best Effort，但不能套到不能漏的指令。
related: ncku-ros2-qos
---

# Reliable 和 Best Effort 取捨

## 先弄懂這個問題

目前的方法是 **ROS 2 QoS／History／Reliability**。ROS 2 的訊息傳遞條件，影響能否連線、是否重傳、保留多少資料。

這個方案的目的是：Best Effort 不要求可靠重傳；少了部分重傳等待成本，但資料可能遺失。

你可以先想像這個情境：影像或高頻感測資料只要最新值，但傳輸偶有延遲。

## 修改前：先看哪裡有問題

```python
# 所有流都不加判斷採用預設可靠策略
sub = self.create_subscription(Msg, topic, cb, 10)
```

## 修改後：對照實作

```python
from rclpy.qos import QoSProfile, ReliabilityPolicy
qos = QoSProfile(depth=5)
qos.reliability = ReliabilityPolicy.BEST_EFFORT
sub = self.create_subscription(Msg, topic, cb, qos)
```

## 逐步理解，為什麼這樣改

Best Effort 可容許訊息遺失，常適合持續更新的感測流，但必須確保與 Publisher QoS 相容。需要每筆事件都到的場景不能只為了看似低延遲就改成 Best Effort。

## 什麼情況才適合

- 可容忍遺失
- 接收端 QoS 必須相容

## 常見錯誤與代價

- 網路不穩時可能丟資料
- 可能不符合控制命令正確性

**正確性界線：** 確認目的端的訊息語意，不要不經審查就從 Reliable 改成 Best Effort。

## 怎麼做測試

用不同丟包/負載條件比較延遲、遺失率、應用正確性；確認 topic info -v 顯示端點相容。

優先觀察：丟失率、延遲、吞吐量。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


確定訊息允許或不允許遺失，需在 Reliable／Best Effort 間取捨時，先對照發送與接收雙方 QoS；不能把降可靠性當成普遍加速方法。

## 參考文件與驗證狀態

- [ROS 2 Jazzy QoS](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
