---
id: ncku-v2-pio-delay-clock
title: PIO Delay Slots 與狀態機時序
category: PIO
tags: pio, delay, side-set, clkdiv, clock, 時序
aliases: pio,delay,side-set,clkdiv,clock,時序
source_type: personal
source_url: https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf
verified: false
updated_at: 2026-11-12
summary: PIO 產生的波形時間不對，先從指令周期與 delay slots 下手。
related: 
priority: P0
difficulty: intermediate
---

# PIO Delay Slots 與狀態機時序

## 遇到什麼情況要查這篇

PIO 產生的波形時間不對，先從指令周期與 delay slots 下手。

## 先理解瓶頸

PIO 指令與延遲欄位決定輸出時序，但 pull/push 的 stall 會讓指令花不只固定周期。先把期待時序寫成 state machine clock 與指令數，不可直接用 CPU 的 clock 推估。

## 具體修改／排查示例

```pio
; 讀法示意，實際 .pio 語法及 clock divider 以專案設定為準
.wrap_target
set pins, 1 [3]    ; 此指令名義上 1 + 3 = 4 個 PIO 周期
set pins, 0 [3]    ; 同上
.wrap
```

## 可以嘗試的方案

### 1. 先算每輪指令周期

**做法**：用指令與延遲計算理想頻率。

**先檢查**：沒有 FIFO stall 或其他阻塞。

**可能的代價**：理論值未必等於實際波形。

**要保留**：邊界周期正確。

### 2. 調整 state machine clock divider

**做法**：透過 PIO clock 而非 CPU 時間控制。

**先檢查**：時脈來源與 divider 已確認。

**可能的代價**：精度與頻率需取捨。

**要保留**：不可超出硬體規格。

### 3. 移除不必要指令

**做法**：簡化循環執行路徑。

**先檢查**：改後輸出語意相同。

**可能的代價**：可能改變相位或時序。

**要保留**：bit 及相位匹配。

## 具體驗證流程

在沒有 Stall 的前提下，先算 period = 8 * T_pio；將 clock divider 與目標頻率記在旁邊。有硬體再用示波器量實際高低電位持續時間，否則只能理論核對。

## 什麼情況不該用

指令 side-set 和 delay 會共用 encoding bits；更動 side-set 規格時可用 delay 範圍可能變小。千萬不要宣稱單靠公式能預測所有實測抖動。

## 參考與查證狀態

- 參考：[RP2350 datasheet](https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf)
