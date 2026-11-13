---
id: opt-transfer-irq-event
title: DMA 中斷與事件通知：官方 Demo 沒有這個 API
category: DMA
tags: DMA, transfer-interrupt-or-poll, 考場排查, 實作條件
aliases: opt-transfer-irq-event, DMA 中斷與事件通知：官方 Demo 沒有這個 API
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: 硬體支援 IRQ 時可事件驅動，但回呼、清旗標及 Buffer 所有權必須核對裝置。
related: ncku-v2-transfer-interrupt-or-poll
---

# Event / IRQ 可以少空轉，但先查你的硬體究竟支援什麼

**重要界線**：官方 `demo/section2-3/transfer-engine/engine.h` 只有 `engine_busy()` 和 `engine_wait()`，**沒有 `engine_set_irq_callback()`** 這種介面。不要讓 LLM 編造函式名，也不要把 MCU 的 DMA 設定直接貼到 Linux pthread 模擬器。

## 正確的概念流程（不是 C API）

```text
1. claim/configure 合法通道與有效 buffer
2. 設定裝置文件指定的完成事件與中斷處理器
3. 啟動傳輸
4. CPU 做其他彼此獨立的工作或等待事件
5. IRQ handler 按硬體文件確認並清除完成旗標
6. 在合法同步後由適當執行緒讀取結果、重用 buffer
7. 解除註冊或釋放 channel
```

清中斷旗標的**時機和方式**不能通用推定；某些硬體需要寫特定值清除。中斷服務函式裡也不適合做大量 Log、阻塞等待或直接處理所有大工作。若使用 DMA 傳入 RAM，Cache 維護及 memory ordering 可能因目標平台而不同；不能當成所有 RP2350 相關記憶體都必須做相同 cache 操作。

## 容易混淆的同名縮寫

這裡說的「中斷服務函式」（Interrupt Service Routine）是一段**由 CPU 在中斷發生時進入的處理程式**。它應先做必要的確認與簡短處理，是否能呼叫特定函式要看平台規範；耗時工作通常交給其他執行脈絡。

但在 PIO 章節，「輸入移位暫存器」（Input Shift Register）是**PIO 狀態機裡存放位元的硬體暫存器**。英文縮寫恰巧一樣，所以只看到三個大寫字母時，不能直接猜它是中斷處理器或 PIO 暫存器。

如何判斷？句子如果講「中斷發生、清旗標、回呼」，通常是 CPU 中斷服務函式；如果講「`in x, 32`、自動推入 RX FIFO、位元移入」，就是 PIO 的輸入移位暫存器。**不要把兩者連到同一篇名詞解釋。**

## 怎麼測才能說有改善

對相同 bytes、transfer width 和資料來源，量 Busy Polling 的 CPU 占用、IRQ 模式的 CPU 占用與整體傳輸時間；確認每個 completion 都有處理，沒有重複、漏訊號或關閉後 callback 仍使用釋放資料。

**驗收**：固定輸入位元組及通道設定，檢查完成通知只對應一次工作，shutdown 後不再使用已釋放的 Buffer。**未測範圍**：沒有 RP2350/Pico SDK 實機與 DMA IRQ 專案。這篇只提供能拿去查硬體文件的決策順序，不含虛構的「通用 IRQ 函式」。
## 深讀延伸｜把原理放進真實情境
## 中斷通知到底省下了什麼？

想像 CPU 啟動一筆資料搬運，需要等它完成。輪詢的版本可能一直重複問「好了沒？」；事件／中斷版可以先做其他工作，等通知再處理結果。**節省的是等待期間的 CPU 佔用**，不是保證資料搬運本身速度變快。若傳輸只有極短時間，切到中斷還可能多出上下文切換成本。

你要追的是完整生命週期：準備來源與目的 buffer → 建立工作 → 啟動 → 等到確認完成 → 同步所需狀態 → 讀結果 → 釋放資源。中斷到達時，回呼或 handler 不應直接做長時間阻塞工作；應按平台要求正確確認／清除通知狀態，並把較重的計算留給適當執行脈絡。

官方 Transfer Engine 是用 pthread 模擬工作，**不能把這篇的硬體 IRQ 當成官方 `engine.h` 一定有的 API**。如果只有 `engine_wait()`，應先用它寫出正確版本，別自己發明 `engine_set_irq_callback()`。

測試要有「一次完成」「沒有資料」「連續大量傳輸」「通道取得失敗」「停止時仍在搬」等路徑。即使 CPU 使用率下降，也要驗證每個結果 buffer 的 bytes 和原本一模一樣。
