---
id: ncku-embedded-riscv-io
title: 嵌入式速查：Microcontroller、RISC-V、GPIO、UART／SPI／I²C
category: Embedded Systems
tags: MCU, RISC-V, ARM, GPIO, UART, SPI, I2C, polling, interrupt, clock
aliases: 微控制器, UART, GPIO, IO, RISC V
difficulty: intermediate
priority: P1
source_type: personal
source_url: https://www.raspberrypi.com/documentation/microcontrollers/
verified: false
updated_at: 2026-11-12
summary: 面對不熟悉的開發板，先知道 CPU、周邊、暫存器、腳位和常見通訊協定的角色。
related: ncku-pio-dataflow, ncku-bitwise-c
---
# 嵌入式系統：從 CPU 到硬體周邊

**Microcontroller（MCU）** 是把處理器核心、記憶體及常用周邊放在晶片中的電腦。RP2350 是一款 MCU 晶片，具有 ARM Cortex-M33 與 Hazard3 RISC-V 核心的架構選項；要看**特定板子如何配置與選擇啟動核心**，不能假設能直接在任意核心上跑同一個程式。

**RISC-V** 是指令集架構（ISA），定義處理器可以執行哪些指令；**ARM** 也是另一種處理器架構。它們都不是 PIO。PIO 是 RP 系列的專用 I/O 狀態機。

## 看懂最基本的 RISC-V 指令形式

```asm
lw  t0, 0(a0)       # 從 a0 指向的記憶體讀 32 bit 到 t0
addi t0, t0, 1     # t0 加一
sw  t0, 0(a0)       # 寫回
```

這是概念示意，並不代表官方的 PIO 範例使用 RISC-V 指令。`lw`/`sw` 操作處理器可見的記憶體；PIO 的 `out`/`in` 則是 PIO 自己的專用指令集。

## GPIO、Polling 與 Interrupt

GPIO 控制數位腳位輸入／輸出，常透過**記憶體映射暫存器**設定。讀、改、寫寄存器時要注意哪些位元是可寫、哪些可能有 side effect。某些 MCU 會提供 set/clear 專用暫存器，減少讀改寫競爭，不能任意照通用 `x |= mask` 修改所有硬體暫存器。

- **Polling**：CPU 不斷查狀態，實作直接但可能浪費 CPU。
- **Interrupt**：硬體發事件通知 CPU，減少無謂輪詢；但有中斷處理、優先級和延遲成本。
- **Clock / divider**：決定周邊執行節奏；調快可能影響時序正確性，不能只看吞吐量。

## UART／SPI／I²C 各做什麼

| 協定 | 最常見特性 | 排查重點 |
|---|---|---|
| UART | 非同步序列傳輸，常有 TX/RX | Baud rate、資料位元、parity、接線 |
| SPI | 同步、時鐘＋資料線＋片選 | Clock polarity/phase、CS、資料寬度 |
| I²C | 兩線共享匯流排、位址式通訊 | 裝置位址、ACK、上拉電阻、clock |

這三類是相關延伸，不是官方 2-2 已要求實作的內容。

## 正式題遇到新硬體時先查

先找 datasheet 的：處理器／ISA、記憶體配置、GPIO pinmux、周邊與時鐘、PIO/DMA、IRQ 和限制事項；再找 SDK 範例與當前板子的 build target。不要只知道晶片型號就猜寫暫存器的位置。

來源：[Raspberry Pi Microcontrollers](https://www.raspberrypi.com/documentation/microcontrollers/)、[RP2350 datasheet](https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf)、[RISC-V ISA](https://riscv.org/specifications/ratified/)。
