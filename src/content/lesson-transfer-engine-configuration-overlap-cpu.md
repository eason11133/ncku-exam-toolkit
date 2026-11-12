---
id: lesson-transfer-engine-configuration-overlap-cpu
title: 搬運期間讓 CPU 做其他獨立工作
category: DMA
tags: Transfer Engine, Transfer Engine／DMA 工作描述, 效能優化
aliases: overlap-cpu, transfer-engine-configuration
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_dma/include/hardware/dma.h
verified: false
updated_at: 2026-11-12
summary: 非同步 DMA 可能讓 CPU 不必親自做搬運，但需考慮完成等待。
related: ncku-transfer-engine
---

# 搬運期間讓 CPU 做其他獨立工作

## 先弄懂這個問題

目前的方法是 **Transfer Engine／DMA 工作描述**。用 channel 描述來源、目的地、count、size、位址遞增，再啟動、等待及釋放。

這個方案的目的是：先 configure/start，做無關工作，再 wait、讀結果。

你可以先想像這個情境：CPU 啟動搬運後立刻等待完成，沒有做其他事。

## 修改前：先看哪裡有問題

```c
start_transfer(desc);
wait_until_done(desc);
process_unrelated_job();
```

## 修改後：對照實作

```c
start_transfer(desc);
process_unrelated_job();   // 前提：不會碰搬運中的 buffer
wait_until_done(desc);
consume_transferred_buffer();
```

## 逐步理解，為什麼這樣改

只有當搬運是非同步、且其他工作互不依賴、buffer 所有權安全時才會重疊。若官方 Demo 的 Transfer Engine 是 thread 模擬，也必須遵守該實作的同步與狀態規則。

## 什麼情況才適合

- 有安全可重疊的 CPU 工作
- 搬運期間不改寫／釋放來源；不把尚在寫入的目的地當成完整結果讀取

## 常見錯誤與代價

- 軟體模擬引擎本身占 CPU
- 硬體 DMA 仍占匯流排

**正確性界線：** 保持緩衝區生命週期與完成順序，測的是整體完成時間。

## 怎麼做測試

比較總耗時與 CPU 使用；同時驗證來源在搬運期間保持有效且未被改寫，目的地只在完成後作為完整結果讀取。CPU 單純讀取不變的來源資料不必一律禁止；若要讀取進行中的目的地，則需另有部分完成與同步協定。

優先觀察：CPU、總耗時、吞吐量、RSS。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


非同步傳輸已啟動卻立即等待、CPU 還有安全獨立工作可做時，才評估先做其他工作再 wait；錯誤資料或 count 單位問題不能靠此修正。

## 參考文件與驗證狀態

- [Pico SDK DMA Header](https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_dma/include/hardware/dma.h)
- [Raspberry Pi Pico SDK Hardware APIs](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)
