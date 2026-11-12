---
id: lesson-rp2350-pio-fifo-fifo-paced-transfer
title: 按 FIFO 節奏供應或消耗資料
category: PIO
tags: PIO, RP2350 PIO／TX RX FIFO, 效能優化
aliases: fifo-paced-transfer, rp2350-pio-fifo
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_pio
verified: false
updated_at: 2026-11-12
summary: 分辨 CPU 等待 FIFO、PIO 消費速度與 CPU 搬運成本，再選擇要改的環節。
related: ncku-pio-dataflow, lesson-rp2350-pio-fifo-pio-with-dma
---

# 按 FIFO 節奏供應或消耗資料

## 先分辨三種不同的瓶頸

CPU 把 word 寫入 **TX FIFO**，PIO 狀態機從 FIFO 取走後才執行後續指令。Pico SDK 的 `pio_sm_put_blocking(pio, sm, word)` **已經會在 TX FIFO 滿時等待**。在它外面再寫 `while (pio_sm_is_tx_fifo_full(...))`，只會多做檢查，不能讓 PIO 更快，也不是這篇的優化方案。相反地，非阻塞的 `pio_sm_put()` 在 FIFO 滿時不會幫你等待，該次寫入不會進 FIFO；兩者不能任意互換。

| 觀察到的現象 | 實際要查的地方 | 可考慮的方向 |
|---|---|---|
| CPU 長時間卡在 `pio_sm_put_blocking()` | TX FIFO 已滿，PIO 取資料的速率低於 CPU 提供速率 | 查 PIO 程式是否在 `WAIT`、`PULL`、IRQ 或外部裝置節奏停住；核對 state machine clock divider 和協定時序。加一層手動輪詢沒有幫助。 |
| PIO 反覆因 TX FIFO 空而停住 | CPU 產生／送入資料的速率不足，或排程延遲 | 減少逐筆產生成本、分批準備資料；若需持續傳送大量資料，再評估 DMA。 |
| PIO 輸出速率正常，但 CPU 忙於逐筆搬運 | CPU 每個 word 都要執行寫 FIFO 的迴圈 | 評估 DMA 依 PIO TX DREQ 搬運，觀察 CPU 可用時間和整體完成時間。 |

FIFO 滿只表示生產者比目前消費者快，**不能單憑這個現象判定錯誤或保證有更高吞吐**。如果 PIO 時脈或外部協定是上限，DMA 也不會提高該上限。

## 考場快速判斷

先分辨 CPU 是卡在 `pio_sm_put_blocking()` 等待已滿的 TX FIFO、PIO 因空 FIFO 等不到資料，還是 CPU 在大量逐筆搬運上花太多時間。前者應先找 PIO 或外部協定的消耗上限；只有確認 CPU 逐筆餵資料是瓶頸且 PIO 有足夠消耗能力，才評估 DMA。手動輪詢 FIFO 不會自動提高吞吐。

## 用真實 Pico SDK API 看原本流程

以下是可放進已初始化 PIO 專案的 **函式片段**；呼叫端仍須載入 PIO 程式、配置並啟動 state machine、提供有效陣列，且確定程式會消耗 TX FIFO。此函式只保證每個 word 已寫入 FIFO，**不保證最後一個 word 已在 pin 上送完**。

```c
#include <stddef.h>
#include <stdint.h>
#include "hardware/pio.h"

void send_words_blocking(PIO pio, uint sm, const uint32_t *words, size_t count) {
    for (size_t i = 0; i < count; ++i) {
        pio_sm_put_blocking(pio, sm, words[i]);
    }
}
```

若應用不能讓當前 CPU 工作卡在這個函式，應重新設計資料生產與傳送的排程，或在大量連續資料情境考慮同庫的〈若硬體支援，評估 PIO FIFO + DMA〉。DMA 用 DREQ 避免向已滿的 TX FIFO 發送下一筆，減少 CPU 的逐筆搬運；它不會解除 PIO 或接收端的速度限制。若使用 RX FIFO，`pio_sm_get_blocking()` 也會在空 FIFO 等待，應先查是 PIO 尚未產生資料，還是 CPU 讀取時機不對。

## 怎麼測，才能知道該改哪裡

固定輸入資料、PIO 程式、時脈及外部裝置，分開記錄：CPU 花在送資料迴圈的時間、PIO 輸出／接收的實際完成時間、有效吞吐與資料順序。測「故意放慢 PIO」與「提高 CPU 端資料準備成本」兩種情境；前者若被 PIO 限制，換 DMA 也不能宣稱輸出更快。檢查每個 word 的數量、順序及協定時序。沒有 RP2350 板與量測結果時，這些都是待驗證的判斷方式，不是實測結論。

## 參考文件與驗證狀態

- [Pico SDK `pio_sm_put_blocking()` 與 `pio_sm_put()`](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_pio)
- [Pico SDK PIO 原始碼 `pio.h`](https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_pio/include/hardware/pio.h)
- API 行為已依官方文件核對；上述函式未在 RP2350 硬體編譯或實測。
