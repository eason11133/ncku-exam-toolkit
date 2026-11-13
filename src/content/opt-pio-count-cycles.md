---
id: opt-pio-count-cycles
title: PIO Delay：把指令週期算對，再談輸出頻率
category: Embedded Systems
tags: Embedded Systems, pio-delay-clock, 考場排查, 實作條件
aliases: opt-pio-count-cycles, PIO Delay：把指令週期算對，再談輸出頻率
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
verified: false
updated_at: 2026-11-13
summary: 無 Stall、無 Side-set 壓縮時，每個指令是 1 + delay cycles；FIFO/WAIT 會改變實際時間。
related: ncku-v2-pio-delay-clock
---

# PIO 每條指令不是都剛好 1 個週期

RP2350 的 PIO 指令一般執行一個 State Machine cycle，方括號 `[n]` 可再插入 n 個額外 Delay cycles。**若沒有等待停滯**，一條 `set pins, 1 [3]` 佔 4 個 state-machine cycles。`PULL/WAIT/PUSH` 可能因 FIFO 或條件而 Stall，因此不能把所有程式一律當成固定週期。

## PIO 組合語法（閱讀範例，需 Pico SDK/PIOASM）

```pio
.program square
.wrap_target
    set pins, 1 [3]
    set pins, 0 [3]
.wrap
```

在 SM 已正確設定 `SET` 的 GPIO/方向，而且上述兩條指令沒有被 Stall 時：高電位 4 cycles、低電位 4 cycles，週期共 8 cycles。`.wrap` 標籤在 PIOASM 用來定義程式回繞位置，**不額外占用一條 PIO 指令**。

## 純 Python 算術檢查（可直接執行）

```python
high_cycles = 1 + 3
low_cycles = 1 + 3
period = high_cycles + low_cycles
assert (high_cycles, low_cycles, period) == (4, 4, 8)
print("high=4 low=4 total=8")
```

如果改成有 Side-set 的 PIO 程式，要留意 Side-set 和 Delay 在同一個指令編碼欄位分配 bits，可用的 Delay 最大值可能下降；不能不看 `.side_set` 設定就假設所有程式都能寫 `[31]`。

**驗收**：畫表列出 PC、指令、Delay、是否可能 Stall；固定 clock divider 與已知 GPIO，實機量週期及占空比。這裡只驗證算術與資料手冊規則，沒有 PIOASM 編譯或 RP2350 波形量測。

---

## 深讀：把「指令時間」和「等待時間」拆開算

有這一段：

```pio
.wrap_target
    set pins, 1 [3]
    set pins, 0 [1]
.wrap
```

在 GPIO 方向、set pins 設定皆正確，且**完全不發生 Stall** 時：

| 指令 | 基本 cycles | Delay | 合計 | 對應腳位狀態 |
|---|---:|---:|---:|---|
| `set pins, 1 [3]` | 1 | 3 | 4 | 高 |
| `set pins, 0 [1]` | 1 | 1 | 2 | 低 |
| 一輪 | | | **6** | 高 4、低 2 |

如果 State Machine 的實際指令時鐘是 12 MHz，理想週期為 `6 / 12,000,000 = 0.5 μs`，理想頻率為 `2 MHz`。Duty cycle 是 `4/6 ≈ 66.7%`，不是 50%。`.wrap` 本身不增加執行指令週期。

但如果程式多了 `wait 1 pin 0`，等多久取決於外部腳位何時變成 1；再把 `push` 加進去，也可能因 RX FIFO 滿而停住。**遇到 WAIT、阻塞式 PUSH/PULL 或需要外部事件，單純加固定 cycle 不再是完整時間公式。**

改 `.side_set` 後，Side-set 與 Delay 共享指令編碼中的部分欄位，Delay 可用位數可能改變。學到「所有指令都能寫 [31]」會害你在真實題目踩雷。

**考場驗收：** 先列表找出可能 Stall 的位置；再核對 clock divider、時脈來源、Pin 設定；最後在有設備時量波形。本篇純數學算例只能確認算式，不代表已用邏輯分析儀測過 RP2350。
