---
id: ncku-v2-transfer-interrupt-or-poll
title: Transfer Engine Busy Polling 與通知方式
category: DMA
tags: engine, busy polling, poll, interrupt, IRQ, wait
aliases: engine,busy polling,poll,interrupt,IRQ,wait
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: 等待搬運完成時 CPU 忙轉，應看是否能阻塞等待或用完成通知。
related: 
priority: P0
difficulty: intermediate
---

# Transfer Engine Busy Polling 與通知方式

## 遇到什麼情況要查這篇

等待搬運完成時 CPU 忙轉，應看是否能阻塞等待或用完成通知。

## 先理解瓶頸

忙等 busy loop 會一直使用 CPU，但可能有很低的喚醒延遲。若搬運耗時較長，改用 wait、事件或 IRQ 可能降低 CPU 消耗；小型工作時通知成本可能反而較高。

## 具體修改／排查示例

```c
// 官方 Demo 已提供的概念 API
engine_configure(ch, &job);
engine_start(ch);
engine_wait(ch);       // 若不需與其他工作交錯，避免 busy loop
engine_release(ch);    // 必須在工作完成後釋放
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 改阻塞等待完成

**做法**：避免等待期間空轉。

**先檢查**：允許目前執行緒等待。

**可能的代價**：喚醒成本可能較高。

**要保留**：完成前不能讀 dst。

### 2. 用完成中斷／事件通知

**做法**：搬完時通知消費端。

**先檢查**：硬體及驅動支援通知。

**可能的代價**：ISR 必須短且安全。

**要保留**：不能漏處理完成事件。

### 3. 短等待才評估適度輪詢

**做法**：把忙等限定在很短的區段。

**先檢查**：等待時間極短且 CPU 夠用。

**可能的代價**：競爭或省電情況可能差。

**要保留**：不破壞資料同步。

## 具體驗證流程

用固定的搬運大小，分別測 busy poll 與阻塞等待的 CPU 使用率、總時間和回應時間。確認在每條執行路徑上都會 wait、release，沒有中途退出而把 channel 卡住。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

官方模擬程式 wait 是 pthread join；不要宣稱它提供真實硬體 IRQ。IRQ 可能需要清旗標和處理同時完成的事件。

## 參考與查證狀態

- 參考：[Raspberry Pi Pico SDK DMA](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
