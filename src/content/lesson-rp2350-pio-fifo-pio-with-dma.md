---
id: lesson-rp2350-pio-fifo-pio-with-dma
title: 若硬體支援，評估 PIO FIFO + DMA
category: PIO
tags: PIO, RP2350 PIO／TX RX FIFO, 效能優化
aliases: pio-with-dma, rp2350-pio-fifo
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: 避免 CPU 持續忙於搬資料，但不保證總延遲更低。
related: ncku-pio-dataflow
---

# 若硬體支援，評估 PIO FIFO + DMA

## 先弄懂這個問題

目前的方法是 **RP2350 PIO／TX RX FIFO**。PIO 狀態機依指令移動資料、控制時序，FIFO 連接 CPU 與 PIO。

這個方案的目的是：DMA 可依 DREQ 與 FIFO 速率協調記憶體和周邊的傳輸。

你可以先想像這個情境：PIO 長時間連續傳輸大量 word，CPU 反覆搬運 FIFO 資料。

## 修改前：CPU 逐筆送入 TX FIFO

Pico SDK 的 `pio_sm_put_blocking()` 在 FIFO 滿時已會等待；改成手動檢查是否已滿，不會加速 PIO。若 CPU 的瓶頸確實是長時間逐筆送資料，才考慮 DMA。

```c
// 片段：pio、sm、words、count 由已初始化的呼叫端提供。
for (size_t i = 0; i < count; ++i) {
    pio_sm_put_blocking(pio, sm, words[i]);
}
```

## 修改後：由真實 Pico SDK DMA 依 TX DREQ 搬運

以下是 **可放進已初始化 PIO 專案的函式片段**，並非獨立可編譯程式。呼叫端須載入 PIO 程式、配置並啟動 state machine、確保其會從 TX FIFO 取資料，且 `words` 至少含 `count` 個 32-bit word。此函式使用一個 DMA channel；產品程式還應處理等候逾時、取消及錯誤回報。

```c
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include "hardware/dma.h"
#include "hardware/pio.h"

bool send_words_dma(PIO pio, uint sm, const uint32_t *words, size_t count) {
    // RP2350 一般 DMA transfer count 的低 28 bit 才是筆數。
    if (!words || count == 0 || count > 0x0fffffffu) return false;
    int channel = dma_claim_unused_channel(false);
    if (channel < 0) return false;

    dma_channel_config cfg = dma_channel_get_default_config(channel);
    channel_config_set_transfer_data_size(&cfg, DMA_SIZE_32);
    channel_config_set_read_increment(&cfg, true);
    channel_config_set_write_increment(&cfg, false);
    channel_config_set_dreq(&cfg, pio_get_dreq(pio, sm, true)); // TX FIFO 可收資料時才搬下一筆

    dma_channel_configure(channel, &cfg, &pio->txf[sm], words,
                          dma_encode_transfer_count((uint)count), true);
    dma_channel_wait_for_finish_blocking(channel);
    dma_channel_unclaim(channel);
    return true;
}
```

`dma_channel_wait_for_finish_blocking()` 等的是 DMA 完成把 word 寫進 TX FIFO，**不是** PIO 已把最後一個 word 輸出到 pin。若協定要求實際輸出完成，還需要依 PIO 程式設計額外的完成訊號或檢查；不能把「DMA 完成」當成「周邊完成」。

## 逐步理解，為什麼這樣改

DMA 可減少 CPU 逐筆寫 FIFO 的工作，但資料仍占用匯流排，PIO 與外部協定的最高速率不會因此自動提高。DREQ 讓 DMA 跟隨 TX FIFO 可用空間；如果原瓶頸是 PIO 時脈或外部裝置，DMA 主要改善的是 CPU 可用時間。官方 Demo 以 thread 模擬的 Transfer Engine 不能當成 RP2350 真硬體 DMA 的效能證據。

## 什麼情況才適合

- 有實體 DMA 與 PIO 支援
- 確認地址、資料寬度、DREQ、完成通知

## 常見錯誤與代價

- 需要通道及匯流排頻寬
- 小資料量或同步成本可能更慢

**緩衝區方向與生命週期：** 上述 TX 範例中，`words` 是 **DMA 讀取的來源**。傳輸期間 CPU 可以讀同一來源的既有資料，但不得改寫、釋放或讓它離開有效生命週期，直到 DMA 已讀完；函式在等待完成後才回傳，呼叫端此時可重用來源。若是相反的 **PIO RX → 記憶體** 傳輸，記憶體是 DMA 寫入的目的地：CPU 不能在完成前把它當作完整新結果讀取，也不能與 DMA 同時寫同一區域；完成後才讀取或重用。使用部分完成資料需要另行設計同步與所有權交接。

**Cache 一致性：** 是否需要在 DMA 前清理來源 Cache、完成後使目的地 Cache 失效，取決於目標晶片、記憶體區域與平台 API。先查該平台文件，**不要把手動 Cache 操作當成所有 RP2350 緩衝區的固定步驟**。Buffer 位址、對齊與 DMA 可存取範圍也須核對。

## 怎麼做測試

核對每個 word 的接收順序及長度，並比較 CPU 占用、傳輸完成時間與記憶體使用。

優先觀察：CPU、吞吐量、延遲、記憶體。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


確認 CPU 長時間忙於逐筆搬運 PIO FIFO，且 PIO 消費速度不是唯一瓶頸時，才評估 DREQ 控制的 DMA。DMA 完成寫 FIFO 不等於腳位輸出完畢。

## 參考文件與驗證狀態

- [Raspberry Pi Pico SDK PIO 與 DMA API](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)
- [Pico SDK DMA Header](https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_dma/include/hardware/dma.h)
- [Raspberry Pi 官方 PIO + DMA 範例](https://github.com/raspberrypi/pico-examples/blob/master/pio/uart_dma/uart_dma.c)
- API 組合已依官方範例核對；此函式未在 RP2350 上編譯或實測。
