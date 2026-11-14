---
id: ncku-pio-dataflow
title: RP2350 PIO：OSR、ISR、FIFO 和最小 echo 程式
category: PIO
tags: RP2350, PIO, OSR, ISR, FIFO, state machine, autopull
aliases: Programmable I/O, out x 32, in x 32, PIO echo
difficulty: advanced
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: 對照官方 demo_pio.pio，從 CPU 到 TX FIFO、OSR、X、ISR、RX FIFO 再回 CPU。
related: ncku-bitwise-c, ncku-transfer-engine
---
# PIO：一小段專門處理 I/O 的程式

RP2350 有專用的 PIO 硬體，每個 PIO block 裡有 state machine（狀態機），可執行短小指令來操控資料及 GPIO 時序。PIO 不是一般 C/Python 執行緒，也不是把所有工作都搬到硬體就會變快。


### PIO 不是另一顆小 CPU

可以把 PIO 想成專門處理接腳時序與位元移動的小幫手。CPU 先把工作規則設定好，PIO 就依短指令反覆執行，但它**不能直接拿一般 C 程式或 Python 程式進去跑**。

RP2350 的每個 PIO block 有 **32 條指令的程式記憶體**，同一個 block 裡的狀態機共用這塊空間。狀態機有 X、Y 兩個暫存器，可暫存處理中的數值；OSR 用來提供輸出資料，ISR 用來收集輸入資料。要和 CPU 交換資料，就經過 TX/RX FIFO。這些不是一般 RAM，所以不要把 PIO 想成能任意建立陣列、配置記憶體的處理器。

如果需求是複雜計算，通常由 CPU 先算好；如果需求是精準重複的腳位操作或位元資料流，才評估交給 PIO。

來源：<https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf>。

## 官方最小範例

```asm
.program echo
.wrap_target
    out x, 32
    in  x, 32
    push
.wrap
```

假設 OSR 已配置適當 autopull，流程如下：

1. CPU 將 32-bit word 放進 TX FIFO。
2. OSR（Output Shift Register）從 TX FIFO 取得資料。
3. `out x, 32` 把 OSR 的 32 個位元移到 X 暫存器。
4. `in x, 32` 把 X 的 32 個位元送入 ISR（Input Shift Register）。
5. `push` 把 ISR 的資料放入 RX FIFO，讓 CPU 取回。
6. `.wrap` 代表回到 `.wrap_target` 繼續執行。

這個 Demo **只要求閱讀，不要求在開發板上執行**。它沒有實際控制腳位，主線是認識資料在 PIO 內怎麼走。

## 哪裡可能卡住？

| 現象 | 可以先檢查 |
|---|---|
| `pull` 等不到資料 | TX FIFO 是否有資料，是否有 autopull |
| `push` 卡住 | RX FIFO 是否滿、CPU 有沒有在讀 |
| 輸入輸出不如預期 | 移位方向、autopull/autopush 門檻、字長、PIO 腳位配置 |
| 速度不穩定 | clock divider、PIO 程式指令延遲、DMA/CPU 餵資料速度 |
| 資料少一個字 | FIFO 順序、32-bit 個數、啟動／停止時序 |

`out`/`in` 是 PIO 指令，不等於 C 語言的 `>>`/`<<`；兩者都涉及位元，但執行的硬體和資料路徑不同。

## 常見優化想法與限制

如果 CPU 不斷用迴圈餵 FIFO，可能占用 CPU。可以研究 DMA 能否搬資料進／出 FIFO，讓 CPU 處理其他工作；但硬體 DMA 需要正確的傳輸尺寸、DREQ 節奏、位址遞增與完成通知，未必能減少總延遲。PIO state machine、FIFO 深度和資料規格也限制了吞吐量。

不要把 PIO 與 DMA 當成一個東西：**PIO 負責 I/O 時序／資料移位；DMA 通常負責在記憶體與周邊之間搬資料**。兩者可以搭配。

來源：[RP2350 datasheet](https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf)；[Raspberry Pi Pico SDK PIO](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_pio)。
