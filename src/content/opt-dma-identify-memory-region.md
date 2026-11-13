---
id: opt-dma-identify-memory-region
title: DMA 前先辨識 SRAM、XIP、周邊與地址可見性
category: Embedded Systems
tags: Embedded Systems, dma-cache-coherency, 考場判讀
aliases: opt-dma-identify-memory-region, DMA 前先辨識 SRAM、XIP、周邊與地址可見性
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
verified: false
updated_at: 2026-11-13
summary: 先核對目標平台記憶體區域，不要一上來就套別台 MCU 的 Cache API。
related: ncku-v2-dma-cache-coherency
---

# DMA 前先辨識 SRAM、XIP、周邊與地址可見性

## 為什麼要先看 Memory Map

`DMA` 的來源／目的地是不是 CPU 和 DMA **都能存取**，與是否需要 Cache 維護，是兩個不同問題。RP2350 有片上 SRAM、XIP 路徑與周邊暫存器；RP2350 Datasheet 指出片上 SRAM 可供 CPU 和 DMA 存取，XIP Flash 的 Cache 行為則有它自己的路徑。不要把這些區域當作一塊完全同質的 RAM。

## 實作前的檢查表

1. 記錄：目標是 RP2350 還是其他 MCU、DMA 要讀哪段、寫哪段。
2. 查 Data Sheet 的 memory map：區域是否 DMA-readable、DMA-writable，是否是周邊暫存器。
3. 核對傳輸單位（1/2/4 bytes 等）、地址對齊、count 溢位與 Buffer 壽命。
4. 查實際平台是否有需要處理的 CPU Data Cache；**不能照抄 Cortex-M7 的 clean/invalidate 呼叫**。

```text
CPU prepares source -> verify accessible memory region
-> configure DMA -> start -> wait for completion
-> CPU reads destination after required synchronization
```

這只是資料流，**不是可直接編譯的 SDK 程式**；不同 MCU 的 DMA API、XIP/Flash 支援和一致性規則需要分開確認。

## 驗收

使用已知字節圖案、跨多個傳輸長度與不同對齊，實機檢查 DMA 結果。此文章沒有宣稱在 RP2350 開發板量測過，也沒有直接列出不存在的通用 cache 清理函式。

## 來源與驗證界線

- 參考：https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。

## 延伸推演｜遇到變形題怎麼判斷

## CPU 看得到一個位址，DMA 未必能照樣存取

把 MCU 的記憶體想成不同區域：SRAM、Flash/XIP、周邊暫存器。CPU 可以讀某些位址，不保證 DMA Controller 也支援完全相同的存取方式、對齊與寬度。移動前必須知道來源和目的地址落在哪個區域，以及該控制器是否支援這種組合。

例如要把一整段資料寫進 PIO TX FIFO：來源通常會往後讀，目的位址則應保持固定的周邊寄存器位置，並配合正確的 DREQ 供給節奏。若把 `write_increment` 設成 true，就可能寫到錯誤周邊位址，不能只看資料是否有搬就認為正確。

Cache 維護要看**目標硬體是否有相關快取及一致性要求**，不能把其他平台的 clean/invalidate 例程通用化。官方 Transfer Engine 是 pthread 模擬，並不會自動測出真正硬體上的位址可見性問題。
