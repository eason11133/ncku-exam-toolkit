---
id: opt-pio-reduce-instructions
title: PIO 指令少一條，訊號真的一樣嗎？逐週期追蹤
category: Embedded Systems
tags: Embedded Systems, pio-delay-clock, PIO, delay, clock divider, wrap
aliases: opt-pio-reduce-instructions, PIO 減少指令, PIO timing
priority: P0
difficulty: intermediate
source_type: personal
source_url: https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
verified: false
updated_at: 2026-11-13
summary: 用週期表比較有無 nop 的 PIO 程式，區分指令數、時序和硬體驗證。
related: ncku-v2-pio-delay-clock, ncku-pio-dataflow
---

# PIO 少一條指令，不一定就比較快

先把 PIO 想成一個會照節拍執行小指令的硬體單元。CPU 不用每次自己去翻 GPIO，PIO 的 State Machine 就可以反覆按照程式輸出訊號。

但外接裝置常在乎「高電位維持幾個週期、低電位維持幾個週期」。所以你不能只把程式縮短，然後就說優化成功。**同樣的指令數、同樣的總週期數、同樣的輸出波形，是三件需要分開看的事。**

## 原程式

```pio
.program pulse_old
.wrap_target
    set pins, 1
    nop [2]
    set pins, 0
    nop [2]
.wrap
```

先不看細節，讀成：輸出高電位、等一下、輸出低電位、再等一下，然後重複。

PIO 指令通常至少執行 1 個 State Machine clock cycle。`[2]` 表示**這條指令做完再額外延遲 2 個週期**，所以 `nop [2]` 共佔 3 個週期。舊程式的高電位從 `set pins,1` 開始，之後的 `nop[2]` 讓這個高電位總共維持 4 個週期；低電位也一樣是 4。

## 修改程式

```pio
.program pulse_new
.wrap_target
    set pins, 1 [3]
    set pins, 0 [3]
.wrap
```

這次把等待時間寫在 `set` 後面的 Delay Slots 裡。每一條 `set` 都是 `1 + 3 = 4` 個週期，**因此在這個非常簡單的示範條件下，高、低各維持 4 個週期**。如果原本只比「指令槽位」：舊程式 4 條，新程式 2 條；但如果比較輸出頻率，在相同時鐘分頻下，它們仍是每 8 週期完成一次高低交替。

| 比較項 | 原程式 | 新程式 |
|---|---:|---:|
| 一輪指令數 | 4 | 2 |
| 高電位週期 | 4 | 4 |
| 低電位週期 | 4 | 4 |
| 高低合計週期 | 8 | 8 |

## 純 Python 對照：只算週期，不是 PIO 模擬器

<!-- test: full-python -->
```python
old_high = 1 + (1 + 2)   # SET + NOP [2]
old_low = 1 + (1 + 2)
new_high = 1 + 3         # SET [3]
new_low = 1 + 3
assert (old_high, old_low) == (new_high, new_low) == (4, 4)
assert old_high + old_low == new_high + new_low == 8
print('same cycles; different instruction count')
```

**注意：** 這個 Python 只能驗證我們自己的算術，不會證明程式真的能在 RP2350 上產生一模一樣的波形。

## 為什麼不能亂套到所有 PIO 程式？

1. **Stall：** `pull` 或 `push` 可能因 FIFO 空／滿而等待。等待多久不是這個靜態週期表能決定的。
2. **Side-set：** PIO 的延遲和 Side-set 會共用指令中的部分位元。開啟 Side-set 後，可用的 Delay bits 可能變少；你不能假定 `[31]` 一定能用。
3. **副作用：** 有些 `mov`、`in`、`out` 會改變暫存器或 shift count。你刪掉它，後面讀到的 bit 就可能不同。
4. **GPIO 設定：** `set pins` 要先正確設定相關 pin，不能只貼這段就假定腳位會輸出。Pin 方向、pin mapping、State Machine 啟動方式都要靠 host 程式設定。
5. **可觀察時序：** 如果你把多條指令合併後，外部裝置要求特定邊緣位置或時鐘相位，**總週期相同也不代表所有邊緣都相同**。要把每個觀察點分開核對。

## 跟官方 Echo Demo 有什麼關係？

官方 Demo 2-2 的 Echo 是：

```pio
out x, 32
in x, 32
push
```

這是為了看 `TX FIFO → OSR → X → ISR → RX FIFO`，不是 GPIO 脈波發生器。`out` 從 OSR 取資料、`in` 寫到 ISR、`push` 送進 RX FIFO。若沒核對 autopull、shift 方向和 push 的狀態，就直接拿別的脈波示範來改 Echo，可能把資料路徑破壞。

## 遇到變形題

題目叫你「用少一點 PIO instructions 達成一樣的輸出」：先列每個週期的輸出，確認指令改動的所有副作用和 FIFO 路徑。少指令是節省**指令記憶體**；要說吞吐量也變快，必須另證明關鍵路徑的週期減少且功能不變。

**驗證狀態：** 已提供純 Python 算術測試；未執行 PIOASM、Pico SDK 或 RP2350 實體輸出，故不能宣稱實機時序已驗證。

來源：RP2350 Datasheet 第 11 章 PIO：https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
