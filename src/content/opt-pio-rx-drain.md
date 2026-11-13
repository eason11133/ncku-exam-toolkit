---
id: opt-pio-rx-drain
title: PIO RX FIFO 堵住：取值、計數與不要讀空 FIFO
category: Embedded Systems
tags: PIO, RX FIFO, push, blocking API
aliases: opt-pio-rx-drain, PIO RX FIFO 堵住
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: CPU 沒及時讀 RX FIFO 可能使 PIO PUSH 停住；使用 blocking API 時必須有完成時機。
related: ncku-pio-dataflow
---

# PIO 能 push 幾次，取決於 RX FIFO 是否有人讀

PIO 的 `IN` 先把資料進 ISR，`PUSH` 才把 ISR 資料送入 RX FIFO。若 RX FIFO 已滿，阻塞式 push 可能讓 state machine 停在那裡。這時候只增加 CPU 對 TX FIFO 的寫入沒有幫助。

## 先讀文件裡的 API 差別

```c
/* Pico SDK 片段；必須已完成 PIO state machine 初始化。 */
#include "hardware/pio.h"

uint32_t receive_one_word(PIO pio, uint sm) {
    return pio_sm_get_blocking(pio, sm);
}
```

`pio_sm_get_blocking()` **在 RX FIFO 空時等待**；`pio_sm_get()` 則是原始讀取，當 FIFO 空時回傳值未定義，且硬體可設 RXUNDER sticky flag。若你不確定未來一定有資料，不能無條件呼叫 blocking 版本等待到永遠；應設計適當的超時、取消或事件流程。

## 和 TX 方向的關係

TX FIFO 水位低可能是 CPU 供料慢，RX FIFO 水位高可能是 CPU 消費慢。對 Echo 程式，CPU 若只送、不讀，很快可能因 `push` 堵住，接著連帶使 TX 端變得無法消耗資料。這是**背壓連鎖**，應先確認哪個位置最早等待。

與 DMA 一起用時，RX 方向的 DMA 會把 FIFO 讀取結果寫到記憶體，CPU 必須在 DMA 完成及必要的同步後才讀新結果；不能把 TX DMA 的「來源只讀」規則拿來套 RX DMA。

## 驗收

對一串含序號的 word，核對 CPU 送出的序號和 RX 取得的序號與筆數；量 RX FIFO level、阻塞時間、是否發生 underflow／overflow。沒有 RP2350 實機時，這篇**僅驗證 API 語意，不宣稱做過硬體測試**。
## 深讀延伸｜把原理放進真實情境
## 用三筆資料追 RX FIFO 是怎麼堵住的

把 PIO 看成一個每輪產生一個 32-bit word 的工人，RX FIFO 是它與 CPU 之間的置物架。若 CPU 一直不拿，架子總會滿。當 PIO 執行阻塞式 `push` 而沒有空位，狀態機會在那裡等待；這時候不是「PIO 不會算」，而是**算好的結果送不出去**。

假設有空位時依序送出 A、B、C，CPU 卻只讀 A。若後續大量持續送資料，最終可能在 Push 停住。不能為了「不卡住」就任意改用會跳過／捨棄資料的方式；如果題目要求結果完整，必須確保 CPU 或 DMA 消費端跟得上，或明確制定背壓策略。

`pio_sm_get_blocking(...)` 的意思是沒有可取資料時會等；若 CPU 沒人送 TX，這個呼叫也可能一直等。排查需要同時看 TX FIFO、RX FIFO、OSR/ISR、State Machine 是否啟動及 CPU 的呼叫順序，不能只看 RX。

**紙筆小測：** CPU 先呼叫「阻塞讀 RX」，但 PIO 要先靠 CPU 送 TX 才會回覆。若這兩件事在同一條 CPU 執行路徑，程式為什麼卡住？因為讀取先等待，永遠走不到送資料那行。修正應先建立資料流，或用正確的並行流程。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：從「卡住在哪個 FIFO」逆推

一開始 RX FIFO 有空位，PIO 不斷 `push`，CPU 卻只做 `pio_sm_put_blocking()`。當 RX FIFO 沒空位時，阻塞式 `push` 可能停下來；State Machine 停住後就不再往下消耗 TX，最後 CPU 的阻塞式送資料也可能跟著停住。

這裡有兩種完全不同的錯誤：CPU 呼叫 `pio_sm_get_blocking()`，但**根本不會有人再送進 RX**，它會等下去；CPU 呼叫 `pio_sm_get()`，卻沒先確認非空，硬體會回報 RXUNDER，讀回的內容未定義。不能為了讓程式『不卡』就直接把 blocking 改成 raw API。

**練習：** 只用一條 CPU 執行路徑，先呼叫 `pio_sm_get_blocking`，下一行才 `pio_sm_put_blocking`。若 Echo 需要先有 TX 才會回 RX，這個順序一定卡住。應先送，或建立真正的並行餵料／接收流程；但先送很多筆也要處理 RX FIFO 滿的背壓。

實測要同時記錄 TX/RX 水位、State Machine 是否啟動、送入／收到的序號，以及超時。只在 CPU 層面印『未卡住』不足以證明沒有丟資料。
