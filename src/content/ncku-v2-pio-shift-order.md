---
id: ncku-v2-pio-shift-order
title: PIO OSR／ISR 移位方向與資料打包
category: PIO
tags: pio, osr, isr, shift, autopull, autopush, 位元順序
aliases: pio,osr,isr,shift,autopull,autopush,位元順序
source_type: personal
source_url: https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
verified: false
updated_at: 2026-11-12
summary: PIO 輸入輸出位元顛倒、錯位，先檢查 OSR/ISR 與 shift direction。
related: 
priority: P0
difficulty: intermediate
---

# PIO OSR／ISR 移位方向與資料打包

## 遇到什麼情況要查這篇

PIO 輸入輸出位元顛倒、錯位，先檢查 OSR/ISR 與 shift direction。

## 先理解瓶頸

PIO 的 `OUT <destination>, <count>` 從 **OSR**（Output Shift Register）移出指定數量的位元；目的地可為 `PINS`、`X`、`Y`、`NULL`、`PINDIRS`、`PC`、`ISR` 或 `EXEC`。`IN <source>, <count>` 則從 `PINS`、`X`、`Y`、`NULL`、`ISR` 或 `OSR` 取位元，移入 **ISR**（Input Shift Register）。所以 `IN` 不只讀 GPIO，`OUT` 也不只輸出到 GPIO。每個指令的來源／目的地是否合法，仍須依 RP2350 PIO 指令表核對；不能把 `MOV` 等其他指令的選項直接套用。

CPU 寫入 TX FIFO 的 word 由 `PULL` 或 autopull 載入 OSR；`PUSH` 或 autopush 才把 ISR 的內容放進 RX FIFO。`IN`／`OUT` 的 shift direction、計數與自動 pull/push 閾值，會影響連續資料的位元排列。CPU 端看到的 32-bit word 必須和 PIO 設定一起解讀，不能一律假設 MSB-first。

## 具體修改／排查示例

官方 Demo 的核心 PIO 指令如下。這是 **PIO 程式片段**，還需要 PIO 程式載入、state machine、TX/RX FIFO 與 shift 設定；不是單靠三行就能在板上執行的完整程式。

```pio
out x, 32
in x, 32
push
```

資料路徑是 **TX FIFO → OSR → X → ISR → RX FIFO**：先讓 OSR 取得 TX FIFO 的一個 32-bit word；`out x, 32` 從 OSR 取 32 位放入暫存器 X；`in x, 32` 再從 X 取 32 位放入 ISR；`push` 把 ISR 的 word 送入 RX FIFO，供 CPU 讀回。若 OSR 沒有資料，需由 `pull` 或符合條件的 autopull 補入；RX FIFO 滿時，阻塞式 `push` 也會等待。這段不經 GPIO，適合用來理解 `IN`／`OUT` 的內部資料路徑。

要查實際 bit 順序，可用固定的 `0xA5`、`0xD2` 等 pattern，依指定 shift direction 推算每一步，再與讀回值或邏輯分析儀結果比較。單純反轉 CPU 端整數的位元序，不能取代對 PIO 指令與自動 pull/push 設定的檢查。

## 可以嘗試的方案

### 1. 釐清 OSR/ISR 的 shift direction

**做法**：先確認 bit 順序才修改程式。

**先檢查**：有固定的輸入 pattern。

**可能的代價**：可能需同步改 CPU 端解碼。

**要保留**：每個 bit 都一致。

### 2. 調整 autopull/autopush threshold

**做法**：依 payload 長度決定何時換字。

**先檢查**：資料寬度與 shift 行為已確定。

**可能的代價**：閾值錯會造成多讀或少讀。

**要保留**：不能漏掉邊界位元。

### 3. CPU 端統一封包編解碼

**做法**：隔離硬體表示與資料格式。

**先檢查**：下游需一致格式。

**可能的代價**：可能增加轉換成本。

**要保留**：端到端資料相同。

## 具體驗證流程

設定固定的 0xA5 或 0xD2 pattern，計算預期 bit stream，跟 PIO 設定逐 bit 對照。若有板子，使用 logic analyzer；沒板子則只做純計算與原始碼核對。

## 什麼情況不該用

改 shift direction 會改整個通訊格式，不可只為了讓數值「看起來正確」就反轉。Autopush/autopull threshold 要與每筆 payload 大小匹配。

## 參考與查證狀態

- [RP2350 Datasheet：PIO 指令集](https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf)
- [Pico SDK PIO instruction encoding 與合法來源／目的地](https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_pio/include/hardware/pio_instructions.h)
- 上述資料路徑依官方指令定義核對；未在 RP2350 板上實測。
