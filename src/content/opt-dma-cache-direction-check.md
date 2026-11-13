---
id: opt-dma-cache-direction-check
title: DMA Cache 維護要看搬運方向，不可套固定口訣
category: Embedded Systems
tags: Embedded Systems, dma-cache-coherency, 考場判讀
aliases: opt-dma-cache-direction-check, DMA Cache 維護要看搬運方向，不可套固定口訣
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
verified: false
updated_at: 2026-11-13
summary: 只有平台真的需要 CPU Data Cache 維護時，才按來源與目的方向處理。
related: ncku-v2-dma-cache-coherency
---

# DMA Cache 維護要看搬運方向，不可套固定口訣

## 先確認「有沒有」這層 Cache

在具有非一致性 Data Cache 的平台，CPU 寫入來源 Buffer 後，DMA 讀取來源前可能需要 Clean；DMA 寫入目的 Buffer 後，CPU 讀新資料前可能需要 Invalidate。**這是有條件的規則**，不是 RP2350 官方 Demo 必定要做的操作。RP2350 的 XIP Cache 與片上 SRAM 也不能混作一談。

## 安全的推理順序（偽碼）

```text
if target has noncoherent data cache for this memory region:
    CPU -> DMA : prepare/clean source according to platform manual
    DMA -> CPU : manage destination cache before/after DMA per manual
DMA start
DMA completion wait / IRQ synchronization
read destination only when complete and visible
```

DMA 寫入時還要留意**快取行大小與範圍對齊**：某些平台的無差別 Invalidate 可能影響同一條 cache line 上其他有效的 dirty data。正確流程應以晶片手冊、RTOS/SDK API 及記憶體屬性規定為準。

## 驗收

比較 CPU 寫完後 DMA 讀的結果、DMA 寫完後 CPU 讀的結果；在各種資料長度、Cache 開關／可用記憶體類型中檢查。這篇只核對通用原則與 RP2350 memory map，**沒有在實機執行 Cache API**。不允許為了「讓範例完整」憑空寫 `dma_cache_clean()`。

## 來源與驗證界線

- 參考：https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 看懂 CPU 和 DMA 為什麼可能「讀到不同版本」

假設 CPU 有一層**非硬體一致性管理**的 Data Cache。CPU 修改了來源 Buffer，但新值還停在 CPU Cache，主記憶體裡可能仍是舊值。若 DMA 直接從主記憶體讀，就可能拿到舊資料。反過來，DMA 寫入目的 Buffer 後，CPU 如果沿用 Cache 中的舊內容，也可能看不到新結果。

這兩種方向的問題不同：

| 資料方向 | 風險 | 典型處理概念（依平台而異） |
|---|---|---|
| CPU 先寫、DMA 再讀來源 | DMA 讀到舊的主記憶體內容 | 傳輸前按平台規則 Clean／同步來源 |
| DMA 先寫、CPU 再讀目的 | CPU Cache 還是舊值 | DMA 完成後按平台規則 Invalidate／同步目的 |

這張表是**有非一致性資料快取的系統**常見推理，不是 RP2350 必做的固定命令。某些平台會由驅動、映射屬性或硬體一致性機制負責；你必須先確認 CPU Cache 架構、Buffer 所在記憶體區域以及 SDK 的 API。

### 為什麼不能「先 Invalidate 再說」？

Cache 維護通常以 cache line 為單位。若同一條線上還有其他尚未寫回的有效資料，亂做 Invalidate 可能把旁邊的修改一起丟掉。正確流程要考慮範圍、對齊、所有權和記憶體屏障，不能自行湊一個 `cache_clean()` 名稱。

### 對官方 Demo 最實用的判斷

2-3 的 Transfer Engine 是**用 pthread 模擬**，並沒有直接驅動 RP2350 DMA。它重點是 `count` 單位、buffer 有效時間、非同步完成。不能因為文中有 DMA 字樣，就在那段 Linux 模擬程式加入 Pico Cache API。

遇到真實板子題時，先把目標平台、記憶體區域、資料方向寫在紙上，再去查手冊。沒有這三項資訊，任何「一定要 Clean／Invalidate」都是不可靠的結論。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：DMA 的 Cache 問題不能背固定口訣

你會看到一些平台教你「DMA 前 clean、完成後 invalidate」，但這是**有適當 Data Cache 架構、方向及記憶體區域條件**下才需要討論的操作。搬運來源是 CPU 寫過的記憶體，和 DMA 寫到 CPU 之後要讀的目的地，可能需要不同的同步；更不能把所有 MCU 都當成有相同 D-cache 的系統。

先畫資料所有權：`CPU 準備來源 → DMA 讀來源 → DMA 完成`，以及 `DMA 寫目的 → 完成事件 → CPU 讀結果`。接著查**這塊記憶體是否可被 DMA 存取、是否有 Cache、是否需要屏障、哪個 API 能確保完成**。在 RP2350 上不能照抄別的處理器的 D-cache clean/invalidate 函式；官方 Demo 的 pthread Transfer Engine 更不是實體 DMA。

**變形題：** 讓 CPU 在 DMA 尚未完成時覆寫來源。即使完全沒有 Cache，也可能讀到混合內容。這是所有權／競爭問題，不是 Cache 維護可以補救的。請先修時序，再談 Cache。
