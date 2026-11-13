---
id: opt-pio-tx-underflow
title: PIO TX FIFO 不夠資料：先分清 CPU 慢或 PIO 停滯
category: Embedded Systems
tags: PIO, TX FIFO, autopull, Pico SDK
aliases: opt-pio-tx-underflow, PIO TX FIFO 不夠資料
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: PIO 等不到輸入與 CPU 卡在滿 FIFO 是相反症狀；需要不同處理。
related: ncku-v2-pio-fifo-stall
---

# PIO TX FIFO 空，不一定是 PIO 指令寫錯

PIO Echo 的資料路徑是 `CPU → TX FIFO → OSR → OUT X → IN X → ISR → PUSH → RX FIFO`。若 PIO 在 `PULL` 或 autopull 取新資料時，TX FIFO 沒資料可供應，它就可能等待。這和 `pio_sm_put_blocking()` 因 FIFO **已滿** 而等待完全相反。

## 用 Pico SDK 真實名稱做排查

```c
/* 函式片段：必須在 Pico SDK 專案、PIO/SM 有效時才可使用。 */
#include "hardware/pio.h"

bool no_pending_tx_data(PIO pio, uint sm) {
    return pio_sm_is_tx_fifo_empty(pio, sm);
}
```

`pio_sm_is_tx_fifo_empty()` 只看到**TX FIFO 當下**是不是空；不能證明 OSR 也空，或 PIO 已經送完最後一個 word。不要把 FIFO level 當作真正 pin 輸出完成的證據。上方不是可在一般 Linux GCC 編譯的程式，它依賴 Pico SDK 與硬體。

## 真正要量的是哪一段

如果 CPU 每個 word 都先做昂貴計算，PIO 可能是等待供應；如果 PIO 本身被 `WAIT`、IRQ 或外部時序卡住，CPU 送得再快也不能改善輸出速度。先比較 CPU 準備資料速率、PIO 消費速率、`pio_sm_get_tx_fifo_level()` 的變化，並追狀態機當前程式。

DMA 可以依 PIO 的 DREQ 節奏持續供料，減少 CPU 逐筆餵資料的工作；但只有在硬體 DMA 可用且 CPU 供料成本是瓶頸時才值得加。**沒有開發板時，只能用官方 API 文件核對流程，不能寫成已測得更快。**

## 驗收

先固定 PIO 程式與一串有序 word，核對輸入／輸出筆數及順序，再逐步調整資料生成速度。對 `0x00000000`、`0xFFFFFFFF`、交錯 bit pattern 逐筆比較；FIFO 空不表示可以任意用舊資料充數。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 先分清兩種相反的等待

**TX FIFO 空**：State Machine 想要下一個 word，但 CPU／DMA 還沒送到，PIO 可能停住。

**TX FIFO 滿**：CPU 想再寫入，使用 `pio_sm_put_blocking` 就可能等待 PIO 消耗資料；這時不是 PIO 缺資料。

用容量 2 的抽象 FIFO 追一輪：CPU 寫 A、B 時，FIFO 是 `[A,B]`；CPU 再寫 C 會遇到「滿」。PIO 取走 A 後變 `[B]`，CPU 才能放 C；PIO 取走 B、C 後若又想取 D，才是「空」。

<!-- v7-test: full-python -->
```python
from collections import deque
q = deque(maxlen=2)
q.extend(['A', 'B'])
if not (len(q) == 2):
    raise RuntimeError("check failed: opt-pio-tx-underflow")
# 真正硬體 blocking write 此時會等待；deque 的 maxlen 會丟舊值，所以不要 q.append('C') 模擬阻塞。
if not (list(q) == ['A','B']):
    raise RuntimeError("check failed: opt-pio-tx-underflow")
if not (q.popleft() == 'A'):
    raise RuntimeError("check failed: opt-pio-tx-underflow")
q.append('C')
if not (list(q) == ['B','C']):
    raise RuntimeError("check failed: opt-pio-tx-underflow")
if not (q.popleft() == 'B' and q.popleft() == 'C'):
    raise RuntimeError("check failed: opt-pio-tx-underflow")
if not (len(q) == 0):
    raise RuntimeError("check failed: opt-pio-tx-underflow")
print('full/empty are different conditions')
```

這是 FIFO 的**抽象資料結構示例，不是 PIO 模擬器**。在真實硬體上還要檢查 OSR 是否已有可用 word、autopull 設定、Shift Direction、State Machine 是否啟動，以及 RX FIFO 有沒有被塞滿。
