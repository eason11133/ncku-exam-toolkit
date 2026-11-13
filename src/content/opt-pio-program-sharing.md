---
id: opt-pio-program-sharing
title: 重用同一個 PIO Program，別每個 SM 都重複載入
category: Embedded Systems
tags: Embedded Systems, pio-state-machine-limits, 考場判讀
aliases: opt-pio-program-sharing, 重用同一個 PIO Program，別每個 SM 都重複載入
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: 指令記憶體是 PIO block 層級資源；State Machine 可以共用已載入程式。
related: ncku-v2-pio-state-machine-limits
---

# 重用同一個 PIO Program，別每個 SM 都重複載入

## 為什麼會載入失敗

每個 PIO block 的指令記憶體有限（典型 RP2350 PIO 有 32 條指令空間），一個 Program 加入後占用一段位置。多個 State Machine 需要跑同一段程式時，不一定要把相同指令重複載入到同一個 PIO block；可以共用已載入的 offset，**每個 SM 仍需獨立設定自己的初始 PC、腳位與 shift config**。

```text
pio_add_program(...) -> offset
SM0 configure program(offset)
SM1 configure program(offset) # 同一個 block 可共用已載入的程式
# 先確認 SM 都不再使用該段程式，才釋放指令記憶體
```

以上是**概念偽碼**，不是完整 Pico SDK C 原始碼。實際使用時請依 SDK `pio_can_add_program()`、`pio_add_program()`、`pio_remove_program()`、State Machine claim 機制處理；不同 PIO block 之間並不共用同一份 Instruction Memory。

**驗收**：記錄每一個 Program 的起點與長度、SM→Program 對照表、資源釋放時機；不要讓仍在跑程式的 SM 使用已被移除或覆蓋的指令。

## 來源與驗證界線

- 參考：https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 深讀延伸｜把原理放進真實情境
## 先分清 PIO block、State Machine、指令記憶體

PIO state machine（SM）可以想成多個各自執行指令的小執行單元；但同一個 PIO block 內的指令記憶體是共享資源。**多個 SM 執行同一段已載入程式**，不代表要把程式複製載入多份。如果只是多開一個 SM，你應先確認新的 SM 能否指向已存在的程式 offset。

想像同一個 block 的指令記憶體位置 0..31 放了長度為 6 的程式。若另一個 SM 也用這個程式，可以設成相同的入口位置；若誤以為每個 SM 都要重新加一次，指令記憶體很快就不夠。這裡的 6 條指令只是紙筆算例，不是官方 Demo 的長度。

修改前需要列出：每個 PIO block 裡載入哪些程式、各從哪個 offset 開始、哪些 SM 仍在執行。若釋放一段程式記憶體，必須確認已經**沒有任何 SM 需要它**。GPIO 的功能、SM 所屬 block 和 PIO 程式配置是不同資源表，不能因為程式能共用就假設 GPIO 也自動共用。

本頁只講資源配置原則；Pico SDK 的具體載入與移除 API、硬體資源數量要以目標 RP2350 設定和實際程式為準，沒有實機驗證。
