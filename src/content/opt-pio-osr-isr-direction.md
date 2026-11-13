---
id: opt-pio-osr-isr-direction
title: PIO OSR／ISR 移位方向：先寫清 LSB-first 還是 MSB-first
category: Embedded Systems
tags: Embedded Systems, pio-shift-order, 考場判讀
aliases: opt-pio-osr-isr-direction, PIO OSR／ISR 移位方向：先寫清 LSB-first 還是 MSB-first
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: SHIFT_RIGHT／SHIFT_LEFT 影響輸出 bit 順序；Echo 整個 word 不足以測所有情境。
related: ncku-v2-pio-shift-order
---

# PIO OSR／ISR 移位方向：先寫清 LSB-first 還是 MSB-first

## 問題在哪

對 `out pins, 1` 等逐 bit 輸出，OSR shift-right 往往先送最低有效位元，shift-left 則先送最高有效位元。ISR 的 `in` 方向也須與封包規則配合。**不要因為完整 32-bit Echo 回送正確就以為逐 bit 順序也正確**：`out x,32; in x,32; push` 是整個字的搬移，不一定能驗出每個 bit 的時間順序。

## 純 Python 比較 8 位元觀察序列

<!-- test: full-python -->
```python
value=0b10100101
lsb_first=[(value>>i)&1 for i in range(8)]
msb_first=[(value>>(7-i))&1 for i in range(8)]
assert lsb_first == [1,0,1,0,0,1,0,1]
assert msb_first == [1,0,1,0,0,1,0,1]  # 此例剛好回文
value=0b10000110
assert [(value>>i)&1 for i in range(8)] != [(value>>(7-i))&1 for i in range(8)]
print('direction patterns differ for 0x86')
```

`0xA5` 左右相反的序列**恰好相同**，不適合當成唯一方向測資；換成 `0x86` 等非對稱 pattern 才能抓出錯誤。這裡的 Python 是**位序模型**，不是 PIOASM 或實機波形測試。

**驗收**：固定 shift config，使用 0x86、0x01、0x80、交錯位元，核對邏輯分析儀輸出序列與時序；同時檢查 pull／push 及腳位方向。

## 來源與驗證界線

- 參考：https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## OSR、ISR 的順序，不能只看 C 裡的 `0x12345678`

`0x12345678` 在人眼裡是 8 個十六進位數字，但 PIO 一次 `out x, 8` 取的是**位元**，而且先取哪一端，要看 State Machine 的 **shift direction**。`out x,32` 是把整個 32-bit word 放入 X，所以你可能看不出方向問題；若改成四次 `out x,8`，順序差異就會跑出來。

例如一個 32-bit word 是 `0x12345678`，若 OSR 往右移且每次取 8 bits，直觀上的四段會是 `0x78、0x56、0x34、0x12`；若往左移，則會從高位那一端開始取。這只是**位元切分的概念說明**；實際 `out` 對 X 的填入位置、FIFO autopull 閾值與 shift counter 仍要依 PIO 設定確認，不該拿 Python 的整數移位冒充 PIO 實機行為。

### Echo 官方範例到底做了什麼？

```pio
.program echo
.wrap_target
    out x, 32
    in  x, 32
    push
.wrap
```

在預期的 autopull 設定下，OSR 從 TX FIFO 補入 word，`out` 把 32 bits 交給 X，`in` 把 X 放入 ISR，`push` 把 ISR 的資料送回 RX FIFO。它不需要 `mov` 才能把 X 送進 ISR。**官方 2-2 用的是 `out → in → push`，不要拿另一支 PIO 程式的 `pull/mov/push` 來解釋它。**

### 三種邊界最容易出錯

- `out` 只拿 8 bits，卻把 autopull threshold 當成 32-bit word 每次都會自動補滿。
- 改了 OSR shift direction，忘記同時考慮 CPU 端打包順序，導致資料 byte 顛倒。
- 沒有人讀 RX FIFO，`push` 被卡住，卻誤以為 TX 資料沒有送進來。

閱讀題可先用 `0x00000001`、`0x80000000`、`0xA5A5A5A5` 做紙上追蹤。要保證實機的位元輸出順序，仍需核對 PIO 配置與硬體資料。
