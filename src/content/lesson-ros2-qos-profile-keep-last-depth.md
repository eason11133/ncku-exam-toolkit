---
id: lesson-ros2-qos-profile-keep-last-depth
title: 評估 Keep Last 的 depth
category: ROS 2
tags: QoS, ROS 2 QoS／History／Reliability, 效能優化
aliases: keep-last-depth, ros2-qos-profile
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-12
summary: 若積壓的是過時狀態，減少 queue 深度可能減少等待。
related: ncku-ros2-qos
---

# 評估 Keep Last 的 depth

## 先弄懂這個問題

目前的方法是 **ROS 2 QoS／History／Reliability**。ROS 2 的訊息傳遞條件，影響能否連線、是否重傳、保留多少資料。

這個方案的目的是：只保留最近 N 筆資料，讓新狀態能較快被處理。

你可以先想像這個情境：Subscriber 偶爾卡住，Queue 裡開始積累舊狀態訊息。

## 修改前：先看哪裡有問題

```python
# 示意：depth 很大，可能先收到許多舊狀態
sub = self.create_subscription(Msg, "/state", cb, 100)
```

## 修改後：對照實作

```python
# 若只需要最新狀態，評估較小 depth（例如 1）
sub = self.create_subscription(Msg, "/state", cb, 1)
```

## 逐步理解，為什麼這樣改

`depth` 控制 Keep Last 歷史深度，但減小可能在忙碌時覆蓋尚未處理的舊訊息。它適用於「最新狀態比每筆紀錄重要」的情境，不適用於不得漏掉每筆事件的交易/日誌。

## 什麼情況才適合

- 業務容許捨棄過時資料
- 負載與收到的 sequence 可量測

## 常見錯誤與代價

- 深度過小會漏資料
- 若每筆都有意義，不能套用

**正確性界線：** 不能把漏資料誤當成效能改善；計算送達率。

## 怎麼做測試

高負載下用序號核對遺失情形，記錄處理資料的新鮮度、端到端延遲與需求是否吻合。

優先觀察：p95 延遲、丟失率、RSS。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


Topic 已連通但 Subscriber 落後、正在處理過時狀態，而且允許捨棄舊狀態時，才評估 Keep Last depth。不能用改 depth 修復 Reliability／Durability 不相容。

## 參考文件與驗證狀態

- [ROS 2 Jazzy QoS](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
