---
id: ncku-v2-pio-shift-order
title: PIO OSR／ISR 移位方向與資料打包
category: PIO
tags: pio, osr, isr, shift, autopull, autopush, 位元順序
aliases: pio,osr,isr,shift,autopull,autopush,位元順序
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: PIO 輸入輸出位元顛倒、錯位，先檢查 OSR/ISR 與 shift direction。
related: 
priority: P0
difficulty: intermediate
---

# PIO OSR／ISR 移位方向與資料打包

## 遇到什麼情況要查這篇

PIO 輸入輸出位元顛倒、錯位，先檢查 OSR/ISR 與 shift direction。

## 先理解瓶頸

OUT 從 OSR 取位元，IN 把 pin 資料塞進 ISR；方向、閾值與每筆資料長度決定高低位如何排列。CPU 端看到的 32-bit 字也要按規格解釋，不能假設永遠是 MSB-first。

## 具體修改／排查示例

```python
# 以 CPU 端 Python 檢查位元輸出順序（與實際 PIO 設定對照）
word = 0b11010010
lsb_first = [(word >> i) & 1 for i in range(8)]
msb_first = [(word >> i) & 1 for i in range(7, -1, -1)]
print(lsb_first, msb_first)
```

## 可以嘗試的方案

### 1. 釐清 OSR/ISR 的 shift direction

**做法**：先確認 bit 順序才修改程式。

**先檢查**：有固定的輸入 pattern。

**可能的代價**：可能需同步改 CPU 端解碼。

**要保留**：每個 bit 都一致。

### 2. 調整 autopull/autopush threshold

**做法**：依 payload 長度決定何時換字。

**先檢查**：資料寬度與 shift 行為已確定。

**可能的代價**：閾值錯會造成多讀或少讀。

**要保留**：不能漏掉邊界位元。

### 3. CPU 端統一封包編解碼

**做法**：隔離硬體表示與資料格式。

**先檢查**：下游需一致格式。

**可能的代價**：可能增加轉換成本。

**要保留**：端到端資料相同。

## 具體驗證流程

設定固定的 0xA5 或 0xD2 pattern，計算預期 bit stream，跟 PIO 設定逐 bit 對照。若有板子，使用 logic analyzer；沒板子則只做純計算與原始碼核對。

## 什麼情況不該用

改 shift direction 會改整個通訊格式，不可只為了讓數值「看起來正確」就反轉。Autopush/autopull threshold 要與每筆 payload 大小匹配。

## 參考與查證狀態

- 參考：[Raspberry Pi Pico SDK PIO API](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)
