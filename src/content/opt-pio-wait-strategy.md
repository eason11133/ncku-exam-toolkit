---
id: opt-pio-wait-strategy
title: PIO 等待策略：Blocking、Polling、DMA DREQ 不可混為一談
category: Embedded Systems
tags: PIO, blocking, polling, DMA, DREQ
aliases: opt-pio-wait-strategy, PIO 等待策略
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: 已有阻塞 API 不需再包一層忙等；要分清等待是必要同步還是吞吐瓶頸。
related: lesson-rp2350-pio-fifo-fifo-paced-transfer
---

# FIFO 滿了，到底要不要寫 while 輪詢？

如果程式已呼叫 `pio_sm_put_blocking(pio, sm, word)`，它在 FIFO 滿時**本來就會等待**。外面再包 `while(pio_sm_is_tx_fifo_full(...))` 不會增加 throughput，只會多一次狀態判斷。改成 `pio_sm_put()` 也不是無痛加速：當 FIFO 滿時，原始寫入會被硬體忽略，且可能設定 TXOVER flag。

## 先看語意，這不是完整硬體程式

```c
#include "hardware/pio.h"

/* 已初始化有效 PIO 與 state machine，且它會消耗資料時： */
void send_one(PIO pio, uint sm, uint32_t word) {
    pio_sm_put_blocking(pio, sm, word);
}
```

此函式返回，只代表資料已成功寫進 TX FIFO，**不代表資料已經完全輸出到 GPIO pin**。如果後續要停掉 state machine 或釋放相關 buffer，需另外定義傳輸完成的條件。PIO 在協定要求的 WAIT 或 delay slot 停住時，不應為了好看而刪掉等待指令。

## 何時選 Polling、Blocking、DMA？

單次操作很少、目前工作允許等待，Blocking 簡單且容易維持次序。若必須在同一 CPU 交錯處理其他任務，需要事件驅動、雙核心分工或 DMA；但 DMA 也要設定 DREQ、搬運寬度、buffer 生命週期與完成通知。Polling 如果一直忙等，可能大幅占 CPU；若等待是極短且平台有即時要求，才有可能合理。

真正的瓶頸可能是 PIO clock divider、外部裝置時序或 FIFO 排程。**有沒有等待不等於能不能加速**，也不能以 CPU 比較閒就直接推論整個操作更快。

**驗收**：固定資料、PIO 程式、時脈和外部裝置；量 CPU 佔用及最後一個 word 的實際完成時刻，核對順序與數量。此處只依 SDK API 校對，未做 RP2350 實機測量。
## 一個 word 從 CPU 送出去，其實經過兩次「完成」

第一次是 CPU 把值寫進 **TX FIFO**。第二次才是 PIO State Machine 從 FIFO 拿走資料，依照指令真正送到外部裝置。`pio_sm_put_blocking` 成功返回只證明第一件事，不代表第二件事已完成。

假設 TX FIFO 容量是 4 個 word，PIO 正在等外部腳位、暫時不消耗：

```text
CPU 放入 A → FIFO [A]
CPU 放入 B → FIFO [A,B]
CPU 放入 C → FIFO [A,B,C]
CPU 放入 D → FIFO [A,B,C,D]（已滿）
CPU 用 put_blocking 放 E → CPU 等待；直到 PIO 取走至少一筆
```

如果你把最後一步改成不檢查容量的 `pio_sm_put`，當 FIFO 滿時 **E 不會被加入**，硬體會留下 TXOVER 旗標供診斷。這不是「沒有等待所以加速」，而是資料遺失。這段是 FIFO 行為追蹤，沒有模擬 PIO 真正的腳位時序。

### 再分清三種等待

**CPU Blocking：** CPU 要寫 FIFO，但沒空位；正在等。

**PIO Stall：** PIO 的 `out` 需要新資料，但 TX FIFO 暫時供不上；或 `push` 時 RX FIFO 滿了；此時停的是 State Machine 的指令執行。

**真正的傳輸時序：** PIO 可能正在執行 `wait`、delay、side-set 等合法指令，為的是滿足外部協定時間，不能把它當成可以直接刪掉的無效等待。

### 遇到延遲題時怎麼選

先畫資料路徑：`CPU → TX FIFO → OSR → X/Pin → ISR → RX FIFO → CPU`。再問卡在**誰**：CPU 餵不夠快、PIO 指令本身花時間、RX FIFO 沒人讀，或外部裝置必須等。只有明確證實 CPU 一筆筆餵資料是瓶頸，才有理由研究 DMA + DREQ；DMA 不會把協定需要的指令週期變沒。

**你可以自己驗證的假設：** 把同樣 100 個 word 送入，核對接收的 count、順序和最後完成時間，再量 CPU 使用率。即使 CPU 更輕鬆，最後完成時間若沒變，也不能說整體 throughput 改善。
