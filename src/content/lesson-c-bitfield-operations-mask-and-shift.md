---
id: lesson-c-bitfield-operations-mask-and-shift
title: Shift + Mask 取欄位
category: C Programming
tags: AND, C Bitwise／Bit Mask／Shift, 效能優化
aliases: mask-and-shift, c-bitfield-operations
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/operator_arithmetic.html
verified: false
updated_at: 2026-11-12
summary: 先右移再用 AND 保留指定的低位寬。
related: ncku-bitwise-c
---

# Shift + Mask 取欄位

## 先弄懂這個問題

目前的方法是 **C Bitwise／Bit Mask／Shift**。位元操作可用來取出資料欄位、設定旗標及重新組合傳輸 word。

這個方案的目的是：例如 bit7..4：`(x >> 4) & 0xFu`；移位量不得達到型別位數。

你可以先想像這個情境：一個 8-bit 狀態 byte，bit 2..4 存 3-bit 模式。

## 修改前：先看哪裡有問題

```c
// 不清楚欄位範圍就直接拿整個 byte
unsigned mode = status;
```

## 修改後：對照實作

```c
#include <stdint.h>
uint8_t status = 0xBCu;
unsigned mode = (status >> 2) & 0x7u;  // 得到 3-bit 欄位
```

## 逐步理解，為什麼這樣改

先右移兩格把最低欄移到 bit 0，再用 `0x7` (二進位 111) 清除其他位。`status` 使用無號型別，避免 signed right shift 的語意問題。

## 什麼情況才適合

- 使用 unsigned 固定寬度型別
- 欄位範圍和位元順序明確

## 常見錯誤與代價

- 原始資料若是 signed 需先轉換
- 超出範圍會被截斷

**正確性界線：** 確認各測試向量的 bit pattern 完全一致。

## 怎麼做測試

測 mode 0..7，並測上下其他 bit 隨機變動時結果不受干擾。

優先觀察：正確解碼、CPU、記憶體。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


需要從整數取出某段 bit 欄位、結果出現位移或遮罩錯誤時，用無號型別確認欄位起點、寬度及預期值。

## 參考文件與驗證狀態

- [C bitwise operators](https://en.cppreference.com/w/c/language/operator_arithmetic.html)
