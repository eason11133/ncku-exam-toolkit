---
id: opt-transfer-few-channels
title: 多個 Channel 不一定比一個快：先看資源與總線
category: DMA
tags: DMA, transfer-channel-scheduling, 考場排查, 實作條件
aliases: opt-transfer-few-channels, 多個 Channel 不一定比一個快：先看資源與總線
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
verified: false
updated_at: 2026-11-13
summary: 通道是有限資源；競爭記憶體頻寬時，更多並行傳輸未必提高吞吐。
related: ncku-v2-transfer-channel-scheduling
---

# 「有四個 Channel」不是「同時搬四份一定四倍速」

官方模擬引擎 `ENGINE_CHANNELS` 是 4。它用 pthread 模擬 Channel 與執行緒，而不是 MCU 硬體 DMA：每個傳輸的 `memcpy`、nanosleep 等工作**仍使用主機 CPU**。因此本機同時啟動 4 個 Thread 的結果，不能推論真實 DMA 的 CPU 負擔或晶片匯流排吞吐。

## 先判斷是否值得並行

若工作 A 要先產生 B 的來源資料，必須等 A 完成；硬把兩筆同時啟動會讀到尚未準備好的資料。即使 A、B 完全獨立，若都走同一個共享記憶體通道，總頻寬也可能成為上限。

```text
方案 1：順序
claim → transfer A → wait → transfer B → wait → release

方案 2：獨立任務的雙 Channel
claim A、claim B → 各自 configure/start → wait A 和 B → 各自 release
（兩組 buffer 不得非法重疊，並確認硬體/模擬引擎實際支援）
```

這是概念流程，不是可以直接貼進 C 的語法。原 Demo 的 `engine_claim` 和全域 Channel 陣列沒有跨呼叫者 mutex 保護，**不得從多條 Thread 同時呼叫其 claim/configure** 並宣稱 thread-safe。做效能比較前要先修正同步缺陷。

## 測量不要只記「主程式有空跑幾圈」

比較一個和兩個 Channel 時，固定完全相同的總 bytes 與工作內容，量端到端完成時間、資料逐 byte 正確、CPU 使用與記憶體頻寬。若工作太短，額外 setup、等待和 Channel 管理成本可能吃掉收益。

**驗收**：同負載跑 1/2/4 channels，驗證每筆都有對應完成和 release；對來源目的重疊、資源耗盡及失敗重試做明確處理。沒有真正 DMA 裝置時，不可把結果寫成硬體加速證據。
## 深讀延伸｜把原理放進真實情境
## Channel 多，不代表有更多記憶體頻寬

例如四筆資料都從同一塊 SRAM 讀寫；新增四個 Channel 可能仍要爭相同匯流排和記憶體頻寬。像四台推車擠一扇門，推車變多不代表門變寬。甚至因為排程和管理額外成本，總時間可能更長。

先分開量三段：`claim/configure` 的設定時間、真正搬運時間、以及 `wait/release` 的完成收尾。若你只量 CPU 「啟動後能做幾次空迴圈」，測到的是 CPU 可用時間，不能宣稱實際傳輸吞吐變大。

要比較 1、2、4 個 Channel，先用相同資料總量，不要讓「4 個 Channel」版本不小心搬了四倍資料。輸出必須逐 byte 相同；若來源／目的區段重疊，要確認是否違反複製 API 的前提。再看共享資料有沒有同步、每個 Channel 何時可釋放。

**練習：** 你有兩個 Channel，但兩筆工作都寫同一個目的 buffer，誰先完成不確定。這不是單純能不能並行的問題；要先解決寫入範圍衝突與順序需求。官方模擬引擎的通道規則和真正 RP2350 DMA 的硬體限制不同，必須分開驗證。
