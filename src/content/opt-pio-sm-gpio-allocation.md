---
id: opt-pio-sm-gpio-allocation
title: 配置 PIO State Machine 與 GPIO 前先做資源表
category: Embedded Systems
tags: Embedded Systems, pio-state-machine-limits, 考場判讀
aliases: opt-pio-sm-gpio-allocation, 配置 PIO State Machine 與 GPIO 前先做資源表
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: RP2350A／RP2350B 腳位範圍不同，Program、SM、GPIO 必須一併確認。
related: ncku-v2-pio-state-machine-limits
---

# 配置 PIO State Machine 與 GPIO 前先做資源表

## 先盤點資源

RP2350 的 PIO block 各有多個 State Machine，Program 指令記憶體是 block 層級，SM、FIFO、GPIO 配置則有自己的限制。RP2350A／B 的 GPIO 可用範圍不同；尤其 RP2350B 較高 GPIO 的 PIO 設定要注意 `GPIO_BASE` 與 Pico SDK 的對應規則。**不能只把程式裡的 pin=18 改成 pin=38，其他一律不變。**

```text
Program Name | PIO block | SM | instruction offset | GPIO range | TX/RX use
Echo         | ...       | ...| ...                | none       | 1 word / 1 word
Output       | ...       | ...| ...                | ...        | ...
```

上表是需要實際填寫的資源表，沒有編造板子的配置值。Pico SDK 提供 `pio_claim_free_sm_and_add_program_for_gpio_range` 等配置功能；**API 是否在當前 SDK 版本可用仍須核對專案依賴**。

## 驗收

多個 Program 同時載入時要驗證指令空間不重疊，所有 SM claim/release 配對；GPIO pin direction、功能、時序及外設衝突檢查。若考場僅讓你閱讀 `.pio` 原始碼，別把「假設的硬體輸出」寫成實測結果。

## 來源與驗證界線

- 參考：https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
- 完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。

## 延伸推演｜遇到變形題怎麼判斷

## 先畫資源表，再決定哪個 State Machine 讀哪組腳位

PIO program 存在指令記憶體裡，State Machine 是執行它的單位，GPIO 是連到外部世界的腳位。三種東西不能混為一談。不同 State Machine 可以執行相同程式，但它們各自的 pin mapping、shift 設定和時鐘可能不同。

假設 SM0 和 SM1 共用一段 PIO 程式；若兩者都嘗試操作同一組 GPIO，可能造成衝突。應列出每個 SM 所屬 PIO block、程式 offset、IN／OUT／SET／Side-set 使用的腳位範圍及時脈設定，確認沒有資源衝突。

不要把 `pio_sm_set_enabled` 當成「自動把所有 GPIO 也設定完成」；腳位方向、功能選擇和 SM 配置仍須依 Pico SDK 使用方式處理。這裡沒有硬體板可驗證 GPIO 波形，實際腳位行為要用目標環境確認。
