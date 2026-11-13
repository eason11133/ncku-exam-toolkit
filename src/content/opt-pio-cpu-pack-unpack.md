---
id: opt-pio-cpu-pack-unpack
title: PIO 前後的 CPU Pack/Unpack 必須一致
category: Embedded Systems
tags: Embedded Systems, pio-shift-order, 考場判讀
aliases: opt-pio-cpu-pack-unpack, PIO 前後的 CPU Pack/Unpack 必須一致
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: 封包的端序、欄位 bit 位置和 PIO shift direction 要一起確認。
related: ncku-v2-pio-shift-order
---

# PIO 前後的 CPU Pack/Unpack 必須一致

## 核心問題

CPU 把多個 sensor 欄位合成 32-bit word 時，先決定每個欄位的位寬、位置和範圍，再選擇 OSR 移位方向。**Byte Order** 描述記憶體／封包多 byte 的順序；**Shift Direction** 描述 PIO 移位暫存器取 bit 的方向，不能當成同一件事。

## 純 Python Pack／Unpack 小測試

<!-- test: full-python -->
```python
# 高 8-bit 是 type，低 8-bit 是 reading；位寬從規格指定
kind, reading = 0x12, 0xAB
word = (kind << 8) | reading
assert word == 0x12AB
assert ((word >> 8) & 0xFF) == kind
assert (word & 0xFF) == reading
raw_be = word.to_bytes(2, byteorder='big')
assert raw_be == bytes([0x12,0xAB])
print(raw_be.hex())
```

此例只驗證 CPU 資料打包，**沒有聲稱 PIO 一定會照 big-endian 先送 0x12**；那要看 OSR 的載入方式、shift config、輸出指令一次送幾個 bits，以及腳位映射。

**驗收**：CPU pack 結果、TX FIFO word、OSR 中的操作、實體 pin 波形、CPU 從 RX FIFO 解碼，逐階段用已知 pattern 核對；不能只看最後的總和對了就認定每個 bit 正確。

## 來源與驗證界線

- 參考：https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。

## 延伸推演｜遇到變形題怎麼判斷

## 同樣的 32-bit word，CPU 和 PIO 可以解讀成不同順序

假設 CPU 要送 0x12345678。若協定以高位 byte 先出，理想順序是 12、34、56、78；若設定改成低位先出或位元移出方向不同，外部看到的順序可能改變。把 word 能「原樣 Echo 回來」當成通訊格式正確是不夠的，因為 Echo 的傳送和接收若有對稱錯誤，最終數值仍可能表面相同。

先把協定分成兩層：byte order（多個 byte 排列）與 bit order（每個 byte 的 bit 順序）。CPU 的 `uint32_t` 在記憶體裡怎麼排列，也不能直接等同 PIO Shift Register 怎麼移出。畫出預期每個邊緣或每 8 bits 的資料，再與設定核對。

**檢查樣本：** `0x00000000` 和 `0xFFFFFFFF` 只能測全 0／全 1，對位元順序不敏感；一定要再加 `0x12345678`、`0xA5A5A5A5` 這種不對稱圖案。這只是推演，實體輸出波形要在裝置上量測。
