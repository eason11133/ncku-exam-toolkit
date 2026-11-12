---
id: lesson-c-bitfield-operations-set-clear
title: 設定位元、清除位元
category: C Programming
tags: AND, C Bitwise／Bit Mask／Shift, 效能優化
aliases: set-clear, c-bitfield-operations
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/operator_arithmetic.html
verified: false
updated_at: 2026-11-12
summary: 用 OR 設 1，AND 搭配 NOT 清成 0。
related: ncku-bitwise-c
---

# 設定位元、清除位元

## 先弄懂這個問題

目前的方法是 **C Bitwise／Bit Mask／Shift**。位元操作可用來取出資料欄位、設定旗標及重新組合傳輸 word。

這個方案的目的是：`x | (1u << b)` 設定，`x & ~(1u << b)` 清除。

你可以先想像這個情境：需要設置 bit 3、清除 bit 1，但其餘位元不變。

## 修改前：先看哪裡有問題

```c
uint8_t flags = 0x02u;
flags = 0x08u;  // 直接賦值會清掉其他所有 bit
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```c
uint8_t flags = 0x02u;
flags |= (uint8_t)(1u << 3);   // 設 bit 3
flags &= (uint8_t)~(1u << 1); // 清 bit 1
```

## 逐步理解，為什麼這樣改

設定用 OR：有一就保留一。清除用 AND 搭配反相 mask：只把指定位置清零。移位數必須小於底層型別寬度，且不要用帶負號的有號值建 mask。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- b < 32 且為 unsigned
- 該欄位不影響保留位元

## 常見錯誤與代價

- 不做檢查會位移越界
- 並發讀寫暫存器可能需要特定硬體原子 API

**正確性界線：**確認非目標 bit 仍保持原值。

## 怎麼做測試

測初值全零、全一、單一位元，確認沒指定的 bit 完全相同。

優先觀察：bit 正確性、執行時間。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **bitmask wrong** 或 **signed shift 或位寬越界** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [C bitwise operators](https://en.cppreference.com/w/c/language/operator_arithmetic.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
