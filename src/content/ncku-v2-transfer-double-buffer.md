---
id: ncku-v2-transfer-double-buffer
title: Transfer Engine 雙緩衝區 Pipeline
category: DMA
tags: double buffer, ping pong, pipeline, DMA, 資料搬運
aliases: double buffer,ping pong,pipeline,DMA,資料搬運
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: 資料搬運與計算能並行時，可以評估 Ping-Pong Buffer。
related: 
priority: P0
difficulty: intermediate
---

# Transfer Engine 雙緩衝區 Pipeline

## 遇到什麼情況要查這篇

資料搬運與計算能並行時，可以評估 Ping-Pong Buffer。

## 先理解瓶頸

單 Buffer 的流程是等待搬完再處理，若搬運與計算可以獨立，兩塊 Buffer 能讓一塊在傳輸、另一塊在計算。前提是「傳輸完成後才能讀取該塊」以及「上一筆處理完才能重用」。

## 具體修改／排查示例

```text
// 概念偽碼：具體 engine API 以專案為準
if (chunks > 0) start_transfer(buf[0], input_chunk[0]);
for (size_t i = 0; i < chunks; ++i) {
    size_t ready = i % 2;
    wait_transfer(ready);          // 這一塊確定搬完才可讀
    if (i + 1 < chunks) {
        size_t next = (i + 1) % 2;
        start_transfer(buf[next], input_chunk[i + 1]);
    }
    process(buf[ready]);          // 同時搬下一塊（另一個 buffer）
}
// 結束時每個傳輸都已 wait；實作須管理 buffer 生命週期
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 雙 Buffer 與非同步傳輸

**做法**：傳輸與計算分別使用不同 Buffer。

**先檢查**：處理與搬運彼此獨立。

**可能的代價**：額外占用一塊 Buffer。

**要保留**：禁止讀寫未完成資料。

### 2. 調整每塊 chunk 大小

**做法**：平衡啟動成本與等待時間。

**先檢查**：可以分塊且每塊可驗證。

**可能的代價**：太小有大量 setup overhead。

**要保留**：資料順序完整。

### 3. 保留單 Buffer 回退路徑

**做法**：高負載錯誤時可用簡單流程。

**先檢查**：正確性優先於峰值效能。

**可能的代價**：可能犧牲吞吐。

**要保留**：與基準輸出完全相同。

## 具體驗證流程

固定相同資料長度和 chunk size，比較逐塊 wait/compute 與 double buffer 總耗時；每塊加序號與 checksum 驗證無覆寫。用額外記憶體量換得的效益也必須記錄。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

官方 Demo 的 transfer engine 是 pthread 模擬，不是硬體 DMA；在電腦上測得「搬運占用核心」不等於 MCU DMA 的 CPU 行為。

## 參考與查證狀態

- 參考：[Raspberry Pi Pico SDK DMA](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
