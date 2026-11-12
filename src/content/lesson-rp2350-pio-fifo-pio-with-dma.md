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

## 修改前：先看哪裡有問題

```text
# 概念：CPU 迴圈把每個 word 都送入 FIFO
for word in words:
    pio_write_tx(word)
```

## 修改後：對照實作

```text
# 概念：平台允許時配置 DMA
# DMA read addr = &words[0]
# DMA write addr = PIO TX FIFO register
# read_increment = true
# write_increment = false
# transfer_count = number_of_words
```

## 逐步理解，為什麼這樣改

DMA 可能減少 CPU 搬運負擔，但需正確的 DREQ pacing、資料寬度、位址、緩衝區生命週期及平台支援；不能把官方以 thread 模擬的 Transfer Engine 直接當成真硬體 DMA。

## 什麼情況才適合

- 有實體 DMA 與 PIO 支援
- 確認地址、資料寬度、DREQ、完成通知

## 常見錯誤與代價

- 需要通道及匯流排頻寬
- 小資料量或同步成本可能更慢

**正確性界線：** DMA 未完成不能讀 buffer，也要檢查 cache 與一致性。

## 怎麼做測試

核對每個 word 的接收順序及長度，並比較 CPU 占用、傳輸完成時間與記憶體使用。

優先觀察：CPU、吞吐量、延遲、記憶體。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **PIO FIFO full** 或 **FIFO 沒有生產者或消費者** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Raspberry Pi Pico SDK Hardware APIs](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)
- [Pico SDK DMA Header](https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_dma/include/hardware/dma.h)
