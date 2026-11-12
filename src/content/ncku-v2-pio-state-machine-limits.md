---
id: ncku-v2-pio-state-machine-limits
title: PIO 指令記憶體與 State Machine 配置
category: PIO
tags: pio, state machine, instruction memory, GPIO, 資源
aliases: pio,state machine,instruction memory,GPIO,資源
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: PIO 程式載入失敗或多個功能互相干擾，要檢查資源限制。
related: 
priority: P1
difficulty: intermediate
---

# PIO 指令記憶體與 State Machine 配置

## 遇到什麼情況要查這篇

PIO 程式載入失敗或多個功能互相干擾，要檢查資源限制。

## 先理解瓶頸

PIO 是資源有限的硬體執行單元：每個 PIO block 的指令記憶體共用，state machine 數目有限，FIFO 也受限制。不能假設「多開幾個 PIO」一定有空間，或把兩份 PIO 程式分開編譯就不佔共用資源。

## 具體修改／排查示例

```text
# 觀念核對表（示意，不是 SDK 指令）
# 1. 找到目標 chip 型號與 PIO block / SM 數量
# 2. 列出每份 .pio 程式的指令數、起始 offset
# 3. 列出 TX/RX FIFO 用量、GPIO pin mapping
# 4. 驗證每個 SM 的 clock、shift、pin 設定
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 重用相同的 PIO 程式

**做法**：避免重複載入同一份指令。

**先檢查**：SDK 支援共享已載入程式。

**可能的代價**：多個 SM 的設定仍須各自處理。

**要保留**：不重複使用衝突位址。

### 2. 縮短 PIO Program

**做法**：用簡單迴圈代替展開指令。

**先檢查**：分支與時序容許更動。

**可能的代價**：可能增加執行周期。

**要保留**：時序仍符合要求。

### 3. 重新分配 SM 與 GPIO

**做法**：避開硬體資源衝突。

**先檢查**：資源清單已釐清。

**可能的代價**：硬體接線與配置可能需改。

**要保留**：pin 行為不變。

## 具體驗證流程

以官方 RP2350 datasheet 或 Pico SDK 讀到的配置表為準，列出每個使用中的 PIO block、SM 與 program。做每次新增功能前後的配置比對，確認不存在重複使用。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

規格對 RP2040/RP2350 可能不同，不要記死通道數；此篇優先提供排查流程，不把特定值視作所有板子的通用常數。

## 參考與查證狀態

- 參考：[Raspberry Pi Pico SDK PIO](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
