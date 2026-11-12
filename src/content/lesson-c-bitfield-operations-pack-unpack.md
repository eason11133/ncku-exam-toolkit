---
id: lesson-c-bitfield-operations-pack-unpack
title: 打包欄位減少資料表示成本
category: C Programming
tags: AND, C Bitwise／Bit Mask／Shift, 效能優化
aliases: pack-unpack, c-bitfield-operations
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/operator_arithmetic.html
verified: false
updated_at: 2026-11-12
summary: 在協定允許時用整數欄位表示多個 flag。
related: ncku-bitwise-c
---

# 打包欄位減少資料表示成本

## 先弄懂這個問題

目前的方法是 **C Bitwise／Bit Mask／Shift**。位元操作可用來取出資料欄位、設定旗標及重新組合傳輸 word。

這個方案的目的是：多個小的欄位組成固定寬度 word，可能減少部分資料表示成本。

你可以先想像這個情境：要把 3-bit 類型和 5-bit 數值放在一個 byte。

## 修改前：先看哪裡有問題

```c
// 兩個值各放一個 byte，傳輸時共 2 bytes
uint8_t packet[2] = {type, value};
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```c
// 前提 type <= 7, value <= 31
uint8_t packed = (uint8_t)((type << 5) | value);
uint8_t decoded_type = (packed >> 5) & 0x7u;
uint8_t decoded_value = packed & 0x1fu;
```

## 逐步理解，為什麼這樣改

高 3 bit 給 type，低 5 bit 給 value。打包節省空間但雙方必須同意欄位佈局；未檢查範圍會導致值被截斷或污染其他欄位。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 傳輸雙方格式一致
- 範圍、端序、對齊已確認

## 常見錯誤與代價

- 改格式有相容性成本
- 若需要額外解碼反而可能變慢

**正確性界線：**先比對逐欄位與原始 bytes，再比較耗時與 bytes。

## 怎麼做測試

對所有 type 0..7、value 0..31 做往返測試，確認解碼完全相同。

優先觀察：bytes per message、編解碼時間、正確性。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **bitmask wrong** 或 **signed shift 或位寬越界** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [C bitwise operators](https://en.cppreference.com/w/c/language/operator_arithmetic.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
