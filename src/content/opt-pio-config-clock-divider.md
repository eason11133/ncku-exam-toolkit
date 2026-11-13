---
id: opt-pio-config-clock-divider
title: PIO Clock Divider：知道除頻改的是整個狀態機速度
category: Embedded Systems
tags: Embedded Systems, pio-delay-clock, 考場排查, 實作條件
aliases: opt-pio-config-clock-divider, PIO Clock Divider：知道除頻改的是整個狀態機速度
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: State Machine 時脈由系統時脈除以 divider；不能忽略實際系統時脈和 Stall。
related: ncku-v2-pio-delay-clock
---

# 延長一個 Delay 和調整 Clock Divider，不是同一件事

**觀察到波形太快**時，先區分你想讓整個 State Machine 的每條指令都變慢，還是只延長某幾個步驟的等待。Pico SDK 的 `sm_config_set_clkdiv` 是設定 State Machine 的 Clock Divider；它影響整個 PIO 程式的執行節奏，不是只增加一條指令的 Delay。

## Pico SDK 實作片段

```c
/* 只可放在已安裝 Pico SDK 的 PIO 配置流程中。 */
#include "hardware/pio.h"

pio_sm_config cfg = pio_get_default_sm_config();
sm_config_set_clkdiv(&cfg, 4.0f);
/* 再依專案設定 pin base、shift、wrap、init；不能單靠這兩行啟動 SM。 */
```

這個函式名稱和用途已依 Pico SDK 文件確認，**未在硬體上編譯**。要確定 Divider 生效，還需把 `cfg` 套用到正確的 PIO/SM，且查板子的實際系統時鐘；RP2350 不應被假定永遠用某個預設頻率。

## 以假設值算例

```python
# 假設 sysclk=125 MHz、divider=4.0、每一輪恰好 8 cycles
sysclk_hz = 125_000_000
clkdiv = 4.0
cycles = 8
sm_hz = sysclk_hz / clkdiv
output_hz = sm_hz / cycles
assert (sm_hz, output_hz) == (31_250_000.0, 3_906_250.0)
```

以上數值只是算例，**不是 RP2350 開發板的實際量測或預設 Clock**。若 FIFO 空、WAIT 條件、IRQ 或其他裝置時序造成 Stall，實際輸出頻率會低於單純算術預估。

**驗收**：讀出系統 clock、SM clock divider、PIO 指令與 Stall 條件；同一程式比較 divider=1、2、4 時的波形頻率／資料完整性。不要為了追速度而破壞 SPI/UART/自訂協定要求的時序。

## 延伸推演｜遇到變形題怎麼判斷

## Divider 改了，整個 State Machine 的節奏都會變

假設狀態機時鐘是 10 MHz，一般每個 PIO 指令週期約 0.1 μs（**純理想算例**）。若某段指令要兩個週期，單就這段指令而言約 0.2 μs；把 divider 加倍，狀態機變慢，指令與 Side-set 的時間也會一起改變。

但 PIO 真實輸出可能因 `wait`、`pull`、`push` 等指令 Stall，不能用「指令數 ÷ 頻率」就當成所有情況的精確答案。當輸出規格要求固定相位時，調 Divider 可能修好頻率卻改壞某個邊緣的時刻。

**練習：** 想把輸出頻率減半，可以先考慮 Divider 或加入 Delay。兩種方法對其他指令的相對時間不一定等效；驗收應拿邏輯分析儀核對波形，而非只看 Echo 值是否相等。
