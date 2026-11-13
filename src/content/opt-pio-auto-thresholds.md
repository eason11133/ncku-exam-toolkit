---
id: opt-pio-auto-thresholds
title: Autopull／Autopush 的 threshold 要和資料寬度配合
category: Embedded Systems
tags: Embedded Systems, pio-shift-order, 考場判讀
aliases: opt-pio-auto-thresholds, Autopull／Autopush 的 threshold 要和資料寬度配合
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: 自動搬移不是萬能；須確認 32-bit word、shift 次數及 FIFO 空滿。
related: ncku-v2-pio-shift-order
---

# Autopull／Autopush 的 threshold 要和資料寬度配合

## 必須理解的設定

Pico SDK 的 `sm_config_set_out_shift(c, shift_right, autopull, pull_threshold)` 控制 OSR 取資料規則；`sm_config_set_in_shift(c, shift_right, autopush, push_threshold)` 控制 ISR 送出規則。門檻是**累計移入或移出多少 bits**，不是「FIFO 裡有多少筆」。設定 32 代表處理完整 word 的門檻；不能把它寫成 32 bytes。

## 對照官方 Demo（PIO 程式片段）

```pio
.program echo
.wrap_target
    out x, 32
    in  x, 32
    push
.wrap
```

這個官方示例依賴 CPU 端**已設定 autopull** 的前提；明確 `push` 送回 FIFO，並不需要再假設 autopush 一定有開。自行把兩個都打開，可能改變送出時機或工作數量，必須重做整條資料路徑驗證。

## 怎麼判斷

- `out x,32` 為何會等資料？核對 TX FIFO、OSR、autopull 和 state machine 是否啟用。
- `in x,32` 後未收到資料？核對 explicit `push`、RX FIFO 是否滿、CPU 是否讀取。
- 改門檻前先確定 shift bit 數、FIFO 傳輸 word 數、預期資料順序。

此文章參照 Pico SDK API 與官方 Demo，**沒有 PIOASM 編譯和 RP2350 開發板執行**。如需正確時序，還要量 state machine clock divider 與 stall。

## 來源與驗證界線

- 參考：https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
- 完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。

---

## 深讀：不要把 threshold 當成 FIFO 容量

`sm_config_set_out_shift(..., autopull, pull_threshold)` 中的 threshold 單位是 **bits**；它不是 TX FIFO 能裝幾筆，也不是 byte 數量。`sm_config_set_in_shift(..., autopush, push_threshold)` 同理，控制 ISR 累積的 bits 到哪裡會推送。

用 32-bit word 來想：`out x, 32` 一次消耗整個 32-bit 資料字；若想每次都取新的一筆，必須確認 OSR 何時補資料、autopull 是不是有啟用。把 threshold 設為 8 不是「把 FIFO 改成 8 筆」；它表示移出某個位數後符合自動補資料條件，可能讓 32-bit word 的使用方式發生本質改變。

`in x, 32` 後，官方 Echo 自己寫了 `push`。如果你又把 autopush 打開並把推送門檻設為 32，可能造成與原來不同的推送動作或資料數量。不要用「理論上自動比較快」取代實際資料完整性測試。

**自己畫圖：** 將每一輪 OSR 的有效資料、X 的值、ISR 的有效資料、RX FIFO 累積筆數畫在紙上；每改一個 threshold，都拿 `0x00000000`、`0xFFFFFFFF`、`0xA5A5A5A5` 三個 pattern 對照。這比只測 `0x12345678` 更容易看到位元錯位和補零問題。

硬體操作之前需按 Pico SDK 設定 PIO state machine，並以實機確認 shift 方向、門檻及 FIFO。這裡只教概念與官方範例依賴條件。
