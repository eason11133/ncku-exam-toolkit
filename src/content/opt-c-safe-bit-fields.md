---
id: opt-c-safe-bit-fields
title: C 位元設定與清除：先分清型別寬度和位移範圍
category: C Programming
tags: bitmask,uint8_t,shift,OR,AND,邊界檢查
aliases: 位元越界,設定bit,清除bit,8位元,bitmask
source_type: personal
source_url: https://en.cppreference.com/w/c/language/operator_arithmetic.html
verified: false
updated_at: 2026-11-13
summary: 用完整且能測試的 C11 範例分辨 8-bit 欄位寬度與整數提升後的 shift 寬度。
related: ops-gcc-compile-link
priority: P0
difficulty: intermediate
---

# 先看清楚要改的變數有多寬

官方 2-2 Demo 使用 `uint32_t x = 0xA5` 示範 AND、OR、XOR、NOT 和 Shift。取低四位：`x & 0x0Fu`；設定 bit 1：`x | (1u << 1)`；清除 bit 0：`x & ~(1u << 0)`。每個運算都有自己的目的，不能用整個數字的賦值代替「只改某個 bit」。

**重要的兩種寬度**：`1u << b` 的 `1u` 通常是 32-bit `unsigned int`，它本身允許 `b=9`；但若接收結果的是 `uint8_t flags`，這個物件只有 8 個 bit。`b=9` 即使位移運算合法，轉回 `uint8_t` 後也存不下該位元。所以要先檢查「目標物件」的範圍。別把 `b < 32` 寫成所有旗標的通用前提。

## 完整可編譯的 C11 程式

```c
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

static bool set_u8(uint8_t *flags, unsigned bit) {
    if (flags == NULL || bit >= 8u) return false;
    *flags = (uint8_t)(*flags | (uint8_t)(1u << bit));
    return true;
}

static bool clear_u8(uint8_t *flags, unsigned bit) {
    if (flags == NULL || bit >= 8u) return false;
    *flags = (uint8_t)(*flags & (uint8_t)~(1u << bit));
    return true;
}

int main(void) {
    uint8_t flags = 0x02u;
    if (!set_u8(&flags, 3u)) return 1;   /* 0x02 -> 0x0A */
    if (!clear_u8(&flags, 1u)) return 1; /* 0x0A -> 0x08 */
    if (set_u8(&flags, 9u)) return 2;    /* 超出 uint8_t 位數，必須拒絕 */
    if (flags != 0x08u) return 3;
    if (set_u8(NULL, 0u) || clear_u8(NULL, 0u)) return 4;
    if (!set_u8(&flags, 7u) || flags != 0x88u) return 5;
    if (!clear_u8(&flags, 7u) || flags != 0x08u) return 6;
    printf("flags=0x%02X\n", (unsigned)flags);
    return 0;
}
```

Linux 編譯：`gcc -std=c11 -Wall -Wextra -Werror -pedantic -O2 bit.c -o bit && ./bit`。預期輸出 `flags=0x08`；其中 `bit.c` 是你儲存上述完整程式的檔名。

## 題目換成 32-bit 要怎麼做？

如果操作的真的是 `uint32_t`，bit 範圍才是 0～31。可以用 `UINT32_C(1)` 當遮罩起點，並檢查 `bit < 32`。對 `uint64_t` 則需 `UINT64_C(1)` 和 0～63。不同型別不能只改變 `flags` 宣告、卻保留原本的檢查條件。

別忽略 `~`：它可能先對整數提升後的寬度取反，再轉成目的型別。上面明確轉回 `uint8_t`，避免誤會取反只影響 8 個 bit。位元操作對一般變數成立，不代表對硬體暫存器的 read-modify-write 一定安全；硬體寄存器還要看官方資料表。

## 怎麼測、什麼時候不能套用

請測：bit 0、bit 7、bit 8／9、NULL 指標、初始值全 0／全 1，以及其他 bit 是否保持不變。若輸入是封包欄位，還要確認 bit numbering、封包 Byte Order 和協定保留位元。**位元寬度合法不保證封包語意合法。**

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`bit_flag_bounds.c`），與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。使用 `gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic -pthread` 編譯後執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```c
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

/* flags has 8 meaningful bits; a bit position >=8 is invalid. */
static bool set_flag(uint8_t *flags, unsigned bit) {
    if (flags == NULL || bit >= 8u) return false;
    *flags = (uint8_t)(*flags | (uint8_t)(UINT32_C(1) << bit));
    return true;
}
static bool clear_flag(uint8_t *flags, unsigned bit) {
    if (flags == NULL || bit >= 8u) return false;
    *flags = (uint8_t)(*flags & (uint8_t)~(uint8_t)(UINT32_C(1) << bit));
    return true;
}
int main(void) {
    for (unsigned bit=0; bit<8; ++bit) {
        uint8_t value=0;
        if (!set_flag(&value,bit) || value != (uint8_t)(1u << bit)) return 1;
        if (!clear_flag(&value,bit) || value != 0) return 2;
    }
    uint8_t v=0xa5u;
    if (set_flag(&v,8) || set_flag(&v,31) || set_flag(NULL,0)) return 3;
    if (clear_flag(&v,8) || v!=0xa5u) return 4;
    puts("8-bit boundary checks PASS");
    return 0;
}
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。
