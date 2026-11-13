---
id: opt-dma-shared-buffer-ownership
title: 共享 DMA Buffer 的生命週期和所有權
category: Embedded Systems
tags: Embedded Systems, dma-cache-coherency, 考場判讀
aliases: opt-dma-shared-buffer-ownership, 共享 DMA Buffer 的生命週期和所有權
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
verified: false
updated_at: 2026-11-13
summary: 不重用尚在傳輸的 Buffer；先確認地址與對齊才談省拷貝。
related: ncku-v2-dma-cache-coherency
---

# 共享 DMA Buffer 的生命週期和所有權

## 使用 Shared Buffer 前先問

一個來源 Buffer 給 DMA 讀取時，CPU 能不能改寫它？**完成前不可以改寫傳輸所需的 bytes**，否則 DMA 可能讀到半新半舊資料。反過來，DMA 正在寫入目的地時，CPU 不能把尚未確認完成的資料當成完整結果。這是所有權／完成順序問題；與是否使用 Cache 相關，但不等於 Cache 問題。

```text
CPU owns source buffer -> fill complete -> hand off to DMA
DMA owns source region while reading -> completion fence/event
CPU may reuse source after completion

DMA owns destination region while writing -> complete + synchronization
CPU reads validated destination -> release/reuse
```

## 兩種可選策略

- 若只有一塊 Buffer：CPU 等 DMA 完成，簡單但可能無法重疊計算。
- 若有兩塊 Buffer：輪流移交所有權，傳輸 B 時可處理已完成的 A；**不能**在 B 還沒完成時改寫 B。

實際 DMA Controller 需要看可用 Channel、DREQ、Address Increment、完成中斷以及平台 Cache 規則；官方示範的 pthread Transfer Engine **不是硬體 DMA**，不能以它的計時當硬體傳輸效能。

**驗收**：帶序號與 checksum 對照全部區塊；壓力測試空輸入、尾塊不足、重複使用和中途失敗的清理路徑。

## 來源與驗證界線

- 參考：https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。

## 延伸推演｜遇到變形題怎麼判斷

## Buffer 在誰手上，決定了哪一刻可以改寫

DMA 或模擬 Transfer Engine 開始讀來源後，CPU 不能在搬運尚未完成時把來源改成下一批資料；不然搬到目的地的可能一半是舊批、一半是新批。傳輸目的地也要等完成與必要同步之後再讀；「指標還有效」不等於「資料已經準備好」。

用兩個 Buffer 時可畫出狀態：`FREE → FILLING → IN_TRANSFER → READY → CONSUMING → FREE`。只有回到 FREE 才能重用。若某一批在 `CONSUMING`，即使 Transfer Engine 早就 wait 完，也不能覆寫，因為 CPU 仍在讀它。

實際硬體 DMA 的記憶體可見性與 Cache 維護要看平台。RP2350 和有 D-cache 的其他處理器不一定相同，不能直接把「所有 DMA 都要 clean/invalidate」寫成通則；官方 Demo 的 pthread 模擬也不具備真硬體 DMA 的時序或 Cache 行為。
