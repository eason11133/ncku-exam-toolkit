---
id: lesson-rp2350-pio-fifo-trace-echo
title: 逐步追出 PIO Echo 資料路徑
category: PIO
tags: PIO, RP2350 PIO／TX RX FIFO, 效能優化
aliases: trace-echo, rp2350-pio-fifo
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: 從 TX FIFO → OSR → X → ISR → RX FIFO 找出資料停在哪。
related: ncku-pio-dataflow
---

# 逐步追出 PIO Echo 資料路徑

## 先弄懂這個問題

目前的方法是 **RP2350 PIO／TX RX FIFO**。PIO 狀態機依指令移動資料、控制時序，FIFO 連接 CPU 與 PIO。

這個方案的目的是：`out x,32; in x,32; push` 可在正確 autopull 設定下送回一個 word。

你可以先想像這個情境：PIO echo demo 傳入資料後沒有回來，不知道是 CPU 還是 State Machine 的問題。

## 修改前：先看哪裡有問題

```text
# 只猜 echo 壞掉，直接改 PIO 指令
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```text
# 排查順序（CLI / pseudocode）
# 1. CPU 確認 TX FIFO 有寫入
# 2. PIO 程式是否執行 pull / mov / push 路徑
# 3. CPU 是否從 RX FIFO 讀取
# 4. 追每個 word 的位元順序與時機
```

## 逐步理解，為什麼這樣改

PIO 有 TX FIFO、OSR、ISR、RX FIFO 等分工；同一個值回不來可能是 FIFO 空、狀態機沒啟動、搬移方向錯，或 CPU 沒有讀取 RX。先描資料路徑再談效能。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- CPU 已寫入 TX FIFO
- state machine 與 autopull 設定已核對

## 常見錯誤與代價

- 未適當配置可能停在 pull/push
- 這只是閱讀範例，非已測實體硬體

**正確性界線：**輸入與輸出每個 32-bit word 應相同、數量與順序正確。

## 怎麼做測試

先用單一固定 word、交錯位元圖案、0xFFFFFFFF 測試；每一步核對資料是否一致。

優先觀察：資料一致性、FIFO 溢出/阻塞。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **PIO FIFO full** 或 **FIFO 沒有生產者或消費者** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Raspberry Pi Pico SDK Hardware APIs](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
