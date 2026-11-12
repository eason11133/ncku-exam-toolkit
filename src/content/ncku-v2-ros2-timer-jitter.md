---
id: ncku-v2-ros2-timer-jitter
title: ROS 2 Timer 延遲與排程抖動
category: ROS 2
tags: timer, jitter, period, 週期, 延遲
aliases: timer,jitter,period,週期,延遲
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html
verified: false
updated_at: 2026-11-12
summary: Timer 設 20ms 卻不穩定觸發，先量實際間隔與 callback 時長。
related: 
priority: P0
difficulty: intermediate
---

# ROS 2 Timer 延遲與排程抖動

## 遇到什麼情況要查這篇

Timer 設 20ms 卻不穩定觸發，先量實際間隔與 callback 時長。

## 先理解瓶頸

Timer 的 period 不等於保證固定的 callback 開始時間；executor 排程、其他 callback、OS 排程、GC 和負載都可能造成 jitter。先明確是要求平均頻率、最晚期限，還是資料新鮮度，優化才有方向。

## 具體修改／排查示例

```python
from time import perf_counter_ns
# timer callback 裡：
now = perf_counter_ns()
if self.prev is not None:
    dt_ms = (now - self.prev) / 1e6
    self.intervals_ms.append(dt_ms)
self.prev = now
# 真正工作另記 callback start/end 時間
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 減少 timer callback 阻塞

**做法**：讓工作更快返回 executor。

**先檢查**：callback 有 I/O 或可移出的計算。

**可能的代價**：工作外移可能改變資料更新順序。

**要保留**：保留每次觸發必做功能。

### 2. 拆開互不相依 callback

**做法**：將 timer 與其他工作分在可並行的 group。

**先檢查**：需要多執行緒且資料同步安全。

**可能的代價**：增加共享狀態風險。

**要保留**：確認定時順序要求。

### 3. 降低更新頻率或合併事件

**做法**：避免排程工作超過處理能力。

**先檢查**：可接受降採樣／批次結果。

**可能的代價**：可能犧牲即時性。

**要保留**：輸出頻率需符合需求。

## 具體驗證流程

在低負載與壓力負載各收集至少幾百次間隔，報告平均、P95、最大值與漏執行次數。再記 callback 本身耗時，分開「開始排程晚」和「執行完得晚」。每輪須使用相同負載與 timer 週期。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

只把計時器週期縮短可能增加排程負載。Python 中 GC、GIL 與系統時間量測方式也會造成差異。

## 參考與查證狀態

- 參考：[ROS 2 Jazzy executors](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
