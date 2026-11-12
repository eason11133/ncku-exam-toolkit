---
id: ncku-v2-c-struct-packing
title: C Struct Layout、Padding 與資料傳輸
category: C Programming
tags: struct, padding, alignment, packet, 封包
aliases: struct,padding,alignment,packet,封包
source_type: personal
source_url: https://en.cppreference.com/w/c/language/object
verified: false
updated_at: 2026-11-12
summary: 把 struct 直接傳到網路或硬體後欄位錯位，要注意 padding 與 endian。
related: 
priority: P0
difficulty: intermediate
---

# C Struct Layout、Padding 與資料傳輸

## 遇到什麼情況要查這篇

把 struct 直接傳到網路或硬體後欄位錯位，要注意 padding 與 endian。

## 先理解瓶頸

編譯器可能為了對齊在 struct 中加入空洞；sizeof(struct) 不一定等於所有欄位寬度總和。直接 memcpy 整個 struct 作為線上格式，還會受到主機 endian 和 ABI 影響。

## 具體修改／排查示例

```c
#include <stdint.h>
// 不把此 struct 直接當線上封包
struct Packet { uint8_t kind; uint32_t value; };
// 線上格式另定長度並逐 byte 解析，例如 value 是 big endian
uint32_t value = ((uint32_t)p[1]<<24) | ((uint32_t)p[2]<<16)
               | ((uint32_t)p[3]<<8) | (uint32_t)p[4];
// 讀取前必須先確認封包長度 >= 5
```

## 可以嘗試的方案

### 1. 定義固定封包位元組格式

**做法**：每個欄位依規格明確解析。

**先檢查**：跨平台或硬體通訊。

**可能的代價**：多寫解析程式。

**要保留**：結果平台一致。

### 2. 調整 struct 欄位排序

**做法**：可能減少 padding。

**先檢查**：僅在程式內用 struct 且不固定 ABI。

**可能的代價**：欄位偏移可能改。

**要保留**：不影響外部格式。

### 3. 先查 alignment 再談效能

**做法**：避免跨架構讀寫錯誤。

**先檢查**：存在指標轉型或 packed 資料。

**可能的代價**：改動可能較大。

**要保留**：無未對齊問題。

## 具體驗證流程

比較 sizeof 與 offsetof，做資料 endian 交叉測試、未對齊位置與短封包測試。使用已知十六進位 payload 核對解碼結果。

## 什麼情況不該用

不建議靠 packed struct 取代正確封包解析；packed 欄位的存取可能有未對齊成本，某些平台甚至不能直接存取。

## 參考與查證狀態

- 參考：[C struct byte alignment](https://en.cppreference.com/w/c/language/object)
