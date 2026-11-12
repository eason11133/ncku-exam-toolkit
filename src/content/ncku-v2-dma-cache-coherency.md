---
id: ncku-v2-dma-cache-coherency
title: 真實 DMA 的 Cache 一致性檢查
category: DMA
tags: dma, cache, coherency, stale data, 記憶體
aliases: dma,cache,coherency,stale data,記憶體
source_type: personal
source_url: https://www.raspberrypi.com/documentation/microcontrollers/
verified: false
updated_at: 2026-11-12
summary: 真實 DMA 資料偶爾讀到舊值，要先查平台是否需要 Cache 維護。
related: 
priority: P1
difficulty: intermediate
---

# 真實 DMA 的 Cache 一致性檢查

## 遇到什麼情況要查這篇

真實 DMA 資料偶爾讀到舊值，要先查平台是否需要 Cache 維護。

## 先理解瓶頸

部分平台中 CPU cache 內尚未寫回記憶體的資料，DMA 讀不到；DMA 寫回記憶體後，CPU 也可能讀到舊 cache。具體是否需要 clean/invalidate 取決於 SoC、記憶體區域和快取一致性設計；不可照搬成所有 RP2350 的固定規則。

## 具體修改／排查示例

```text
// 平台相關的概念流程，非可直接編譯的共用 API
// CPU -> DMA：填好 src buffer；必要時按平台文件 clean cache
// start DMA / wait completion
// DMA -> CPU：必要時按平台文件 invalidate cache
// CPU 讀取 dst 前，確認硬體完成且符合所需記憶體順序
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 核對平台記憶體區域

**做法**：先確定 DMA 可存取且區域是否 cacheable。

**先檢查**：有目標平台文件。

**可能的代價**：平台不可攜。

**要保留**：沒有舊資料。

### 2. 依平台做必要 Cache 維護

**做法**：補齊 DMA 前後可見性操作。

**先檢查**：確定 CPU/DMA 存取方向。

**可能的代價**：清理成本與對齊要求。

**要保留**：不覆蓋有效資料。

### 3. 改用適當共享緩衝區

**做法**：減少不必要的 cache 操作。

**先檢查**：平台有相容配置。

**可能的代價**：可能增加記憶體成本。

**要保留**：可見性仍正確。

## 具體驗證流程

先測純 CPU copy 保證正確，再測 DMA；用不同大小和對齊方式做 checksum，並檢查實際平台 memory map 與 cache policy。若沒有目標板，就只列排查線索，不宣稱實測。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

Cache 清除、Memory barrier、volatile 用途不同，不能互相替代；錯誤 invalidate 可能丟掉 CPU 尚未寫回的修改。

## 參考與查證狀態

- 參考：[Raspberry Pi DMA documentation](https://www.raspberrypi.com/documentation/microcontrollers/)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
