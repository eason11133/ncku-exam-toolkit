---
id: lesson-rp2350-pio-fifo-fifo-paced-transfer
title: 按 FIFO 節奏供應或消耗資料
category: PIO
tags: PIO, RP2350 PIO／TX RX FIFO, 效能優化
aliases: fifo-paced-transfer, rp2350-pio-fifo
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: 避免 CPU／DMA 不適當的進出速率造成欠載與阻塞。
related: ncku-pio-dataflow
---

# 按 FIFO 節奏供應或消耗資料

## 先弄懂這個問題

目前的方法是 **RP2350 PIO／TX RX FIFO**。PIO 狀態機依指令移動資料、控制時序，FIFO 連接 CPU 與 PIO。

這個方案的目的是：確認 TX/RX FIFO、PIO state machine 的執行速率與資料消費速率。

你可以先想像這個情境：CPU 連續寫 TX FIFO，寫入速度超過 PIO 消耗速度。

## 修改前：先看哪裡有問題

```text
# 概念錯誤：不檢查 FIFO 是否可寫就連續寫
for word in data:
    write_tx(word)
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```text
# 示意：使用對應平台 SDK 的 FIFO 狀態函式
for word in data:
    while tx_fifo_full(sm):
        wait_briefly()
    write_tx(word)
```

## 逐步理解，為什麼這樣改

FIFO 滿時要決定等待或非同步回報；RX FIFO 空時也不能當作資料已經到。`tx_fifo_full`、`write_tx` 是示意 API，不是可直接執行的 SDK。長時間忙等會吃 CPU，可依環境改通知式處理。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 能讀取或推導 FIFO 狀態
- 有實際目標硬體與 PIO 設定

## 常見錯誤與代價

- 增加緩衝會占資源
- 錯誤的 FIFO 方向或時序會造成資料遺失

**正確性界線：**不改變協定輸出與時序的正確性。

## 怎麼做測試

先用慢速 PIO 故意填滿 FIFO，檢查無丟字與無死鎖；再量 CPU 忙等比例。

優先觀察：有效吞吐、丟失率、CPU。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **PIO FIFO full** 或 **FIFO 沒有生產者或消費者** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Raspberry Pi Pico SDK Hardware APIs](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
