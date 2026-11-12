---
id: ncku-v2-ros2-topic-backlog
title: ROS 2 Topic 堆積與舊訊息
category: ROS 2
tags: backlog, 消息堆積, stale message, queue, depth
aliases: backlog,消息堆積,stale message,queue,depth
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-12
summary: 訂閱資料越跑越舊，可能不是接收不到，而是消費速度追不上發布。
related: 
priority: P0
difficulty: intermediate
---

# ROS 2 Topic 堆積與舊訊息

## 遇到什麼情況要查這篇

訂閱資料越跑越舊，可能不是接收不到，而是消費速度追不上發布。

## 先理解瓶頸

先分別量發布頻率、訂閱端完成頻率與訊息年齡。佇列越長不一定越好：若需要最新感測資料，保留一堆舊資料反而使延遲增加；若必須處理每筆記錄，丟棄又可能錯。不要用 QoS 更動掩蓋計算瓶頸。

## 具體修改／排查示例

```python
# 只有在「只關心最新狀態」且可容許丟資料時才用
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
qos = QoSProfile(depth=1, history=HistoryPolicy.KEEP_LAST,
                 reliability=ReliabilityPolicy.BEST_EFFORT)
# 建立 publisher / subscriber 時要核對 QoS 兼容性
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 需要最新狀態時減小 depth

**做法**：降低舊資料排隊時間。

**先檢查**：允許漏掉中間更新。

**可能的代價**：可能失去每筆事件。

**要保留**：最後狀態仍正確。

### 2. 加快消費端處理

**做法**：處理根因而非只調 queue。

**先檢查**：callback 耗時是瓶頸。

**可能的代價**：可能增加 CPU 負載。

**要保留**：不更改原始消息序列。

### 3. 批次處理或流控

**做法**：避免生產速度無限制超過消費。

**先檢查**：上下游可調整節奏。

**可能的代價**：批次可能增加最短延遲。

**要保留**：必須定義丟棄或背壓政策。

## 具體驗證流程

每則訊息攜帶發送時間戳／序號，計算丟失率、處理率、age_ms 的 P95。分別測小負載、突發負載與服務恢復；每種更動前先決定允不允許丟資料。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

BEST_EFFORT 可以丟訊息，且 QoS 不相容時可能完全無法通訊；若時間戳在不同機器，必須考慮時鐘同步。

## 參考與查證狀態

- 參考：[ROS 2 Jazzy QoS overview](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
