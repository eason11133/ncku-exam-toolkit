---
id: opt-transfer-blocking-wait
title: 等待傳輸完成：Busy 與 Wait 的差別
category: DMA
tags: DMA, transfer-interrupt-or-poll, 考場排查, 實作條件
aliases: opt-transfer-blocking-wait, 等待傳輸完成：Busy 與 Wait 的差別
difficulty: intermediate
priority: P0
source_type: personal
verified: false
updated_at: 2026-11-13
summary: 官方 Demo engine_wait 可等待模擬 Thread 結束，但 volatile busy 並非合法跨執行緒同步。
related: ncku-v2-transfer-interrupt-or-poll
---

# `engine_busy()` 回傳 false 和「安全讀取結果」不可隨便畫等號

官方 `engine.c` 用 pthread 模擬搬運：`engine_start()` 啟動另一條 Thread，`engine_wait()` 透過 `pthread_join` 等它結束。原程式 `channel_t.busy` 是 `volatile bool`，不是 atomic；在 C 中一邊寫、一邊由另一條 Thread 讀仍可能構成 data race。因此**本篇只描述官方介面的意圖**，不能拿它當通過執行緒安全驗證的庫。

## 正確操作順序（整合片段）

```c
/* 先成功 claim，job 及緩衝區已檢查，再開始。 */
engine_configure(ch, &job);
engine_start(ch);
/* 可做完全不讀寫這次來源/目的的其他工作。 */
engine_wait(ch);         /* 示範用的完成同步 */
/* 現在才讀取 dst，檢查是否與預期一致。 */
engine_release(ch);
```

這段不能獨立編譯；真實程式需要 `engine.h`、正確配置和錯誤處理。`engine_wait` 之後仍須檢查資料的值、長度與傳輸狀態；「不忙」不代表「結果正確」。真實 DMA 的完成旗標／中斷、cache coherency 與 buffer 所有權須依硬體手冊處理。

## 什麼時候用阻塞等待

如果 CPU 已經沒有可獨立進行的工作，直接等完成比自己一直用 while 空轉更簡單；如果 CPU 可做真正獨立工作，先做再 wait。但不能在結果尚未完成時預先讀 `dst`，也不能提早重用或釋放 buffer。

**驗收**：先比對 8-bit、16-bit、32-bit 不同 count 的實際 bytes；刻意延後搬運時，確認只有 wait 後才檢查結果。此次沒有重新把官方具 data race 的 engine 當成安全程式執行保證。
## 深讀延伸｜把原理放進真實情境
## `busy == false`、`wait` 和安全讀取，是三個要分開看的問題

官方 Demo 的 Transfer Engine 是用 pthread 模擬搬運，`busy` 在範例裡使用 `volatile bool`。**volatile 不保證跨執行緒同步**；單靠一個未同步的忙碌旗標，在標準 C 記憶體模型下有 Data Race 風險。請勿把原 Demo 的 `busy` 寫法當成生產環境安全範本。

使用上先記住順序：`claim → configure → start → wait → verify dst → release`。`start` 只代表啟動，不等於結果已經完成；`wait` 要依照 API 契約確認工作結束、必要的同步關係建立後，才能讀取目的資料。程式若在傳輸期間先讀 `dst[0]`，可能看到舊值或部分寫入結果，即使最後一次測試剛好正確也沒用。

例如要搬 `count=4`、每筆 `size=4 bytes`，來源與目標各至少要有 16 bytes 的有效空間；`count` 是四**筆**，不要填成 16。若 API 使用 `count × size` 做容量檢查，要先避免這個乘法自己就 overflow。

**變形題：** 多條 Channel 分別寫同一塊目的緩衝區。就算全部都 wait 完，你仍不能保證最後輸出符合預期，因為它們互相覆寫的順序可能不確定。等待完成處理的是生命週期，不會自動處理資料範圍衝突。

## 主來源與查證界線

本篇自訂 Transfer Engine API 以使用者提供的成大練習 Demo `demo/section2-3/transfer-engine/engine.h`、`engine.c` 為主來源；`engine.h` 定義公開介面，`engine.c` 顯示 pthread 模擬與通道生命週期。這不是 Pico SDK 的 DMA API，亦未在本輪重新編譯完整 Demo。
