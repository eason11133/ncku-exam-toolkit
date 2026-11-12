---
id: ncku-v2-pio-fifo-stall
title: PIO FIFO 空／滿導致的 Stall
category: PIO
tags: pio, fifo, stall, pull, push
aliases: pio,fifo,stall,pull,push
source_type: personal
source_url: https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
verified: false
updated_at: 2026-11-12
summary: PIO 狀態機停住，先確認 pull/push 是否卡在 FIFO。
related: 
priority: P0
difficulty: intermediate
---

# PIO FIFO 空／滿導致的 Stall

## 遇到什麼情況要查這篇

PIO 狀態機停住，先確認 pull/push 是否卡在 FIFO。

## 先理解瓶頸

PIO state machine 有自己的程式；pull block 在 TX FIFO 沒資料時會等，push block 在 RX FIFO 滿時會等。等待不等於故障，也可能是背壓的預期行為。若狀態機已被阻塞，增加 PIO 指令速度也沒用。

## 具體修改／排查示例

```pio
; PIO 概念片段，不是可直接編譯的完整 .pio 程式
pull block      ; TX FIFO 空時會等待
out pins, 1     ; 把 OSR 中的 1 bit 輸出
; RX 接收路徑會用 in / push；要確認 FIFO 消費端有在讀
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 補足 TX FIFO 資料

**做法**：確保輸出 state machine 有資料。

**先檢查**：CPU 或 DMA 能提供足夠吞吐。

**可能的代價**：可能提高上游負載。

**要保留**：輸出位元序列正確。

### 2. 及時清空 RX FIFO

**做法**：避免輸入路徑在 push 卡住。

**先檢查**：消費端跟得上資料率。

**可能的代價**：可能增加中斷與 CPU 成本。

**要保留**：不可默默丟關鍵資料。

### 3. 重新設計等待策略

**做法**：只有允許資料遺失才考慮非阻塞讀寫。

**先檢查**：明確定義缺資料時如何處理。

**可能的代價**：資料語意可能改變。

**要保留**：資料完整性需驗證。

## 具體驗證流程

分別檢查 CPU 是否持續寫 TX FIFO、讀 RX FIFO，記錄 FIFO level 或等待事件；用固定輸入資料測預期輸出數目。若沒有開發板，明確標示只能閱讀規格，不能宣稱已在硬體跑過。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

把 block 改 noblock 會改變資料缺失時的行為，可能送出預設值或舊值，不是單純加速。

## 參考與查證狀態

- 參考：[RP2350 datasheet](https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
