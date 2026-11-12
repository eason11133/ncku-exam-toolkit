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

以下是 **完整 C11 程式**。線上格式固定為 5 bytes：第 0 byte 是 `kind`，第 1～4 byte 是 big-endian `value`。函式先檢查指標與長度，再逐 byte 解析；成功才寫入輸出參數。

```c
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

struct Packet { uint8_t kind; uint32_t value; };

bool parse_packet(const uint8_t *data, size_t length, struct Packet *out) {
    if (data == NULL || out == NULL || length < 5) return false;

    struct Packet parsed;
    parsed.kind = data[0];
    parsed.value = ((uint32_t)data[1] << 24)
                 | ((uint32_t)data[2] << 16)
                 | ((uint32_t)data[3] << 8)
                 |  (uint32_t)data[4];
    *out = parsed;
    return true;
}

int main(void) {
    const uint8_t valid[5] = {0x7a, 0x12, 0x34, 0x56, 0x78};
    struct Packet result = {0};
    assert(parse_packet(valid, sizeof valid, &result));
    assert(result.kind == 0x7a && result.value == UINT32_C(0x12345678));
    assert(!parse_packet(valid, 4, &result));
    assert(!parse_packet(NULL, 5, &result));
    return 0;
}
```

`struct Packet` 是解析後供程式內部使用的表示，**不是**可直接寫上線的 5-byte 格式；它的 `sizeof` 與欄位偏移仍由平台 ABI 決定。如果協定要求長度恰好 5 bytes，而不能有尾隨資料，應把 `length < 5` 改成 `length != 5`。

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
- [WG14 C11 草案 N1570 §6.7.2.1：struct 對齊與 padding](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)
