---
id: opt-c-unsigned-modulo
title: 32-bit unsigned：何時允許 modulo 2^32
category: C Programming
tags: C, unsigned, integer overflow, modulo
aliases: opt-c-unsigned-modulo, 32-bit unsigned
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/operator_arithmetic
verified: false
updated_at: 2026-11-13
summary: 無號溢位的模數語意是定義好的，但前提是題目真的要求繞回。
related: ncku-v2-c-signed-overflow
---

# unsigned 溢位是有定義的，但不代表答案一定對

C 的 `uint32_t` 加法用模 `2^32` 的規則；`UINT32_MAX + 1` 變成零。適合 bit mask、計數器或封包協定**明確規定 modulo** 的情況。若規格要的是不能丟失數值的總和，就不能只把 `int` 改成 unsigned 逃避溢位。

## C11 可編譯執行

```c
#include <stdint.h>
#include <inttypes.h>
#include <stdio.h>

static uint32_t add_wrap(uint32_t a, uint32_t b) {
    return a + b;
}

int main(void) {
    uint32_t top = UINT32_MAX;
    if (add_wrap(top, UINT32_C(1)) != 0) return 1;
    if (add_wrap(UINT32_C(5), UINT32_C(7)) != 12) return 2;
    printf("unsigned=ok max=%" PRIu32 "\n", top);
    return 0;
}
```

固定寬度 `uint32_t` 只在平台有該型別時存在；在這個網站的 Linux GCC 目標可使用。用 `%u` 直接印 `uint32_t` 可能有平台型別不一致的風險，所以用 `<inttypes.h>` 的 `PRIu32`。

## 為什麼 signed 不一樣？

`int32_t` 的計算若超出範圍，在標準 C 是未定義行為；編譯器優化可以假設它不會發生。`-fwrapv` 只改變 GCC 某些 signed overflow 的假設，不會讓位移越界、buffer 溢位或 data race 自動安全。

**考場判斷**：先看題目是否允許數字繞回；若要求精確加總，用更寬的型別或先檢查範圍。測 0、1、`UINT32_MAX`、跨界及不同編譯優化等級，並逐項核對規格。

## 驗收範圍與限制

逐一確認題目允不允許 modulo 2^32，測 MAX+1、零、一般加法；不能拿這個當 signed overflow 的處理法。
## 深讀延伸｜把原理放進真實情境
## C 裡「溢位」不是同一種東西

對 `uint32_t`，數值是 0 到 `2^32−1`，合法的無號加法結果會模 `2^32` 回繞。因此 `UINT32_MAX + 1u` 在相容的無號型別語意下得到 0。可是有號 `int32_t` 超過最大值，不能直接說「也會變成負數」；**signed overflow 是未定義行為**，不能靠觀察一次結果來保證。

若題目要數學上的精確總和，使用 uint32 回繞反而是錯誤；應改用足夠寬的型別，並檢查加法前的範圍。若題目明確要求封包 checksum 的模數運算，使用無號型別才是合理設計。

左移要另外小心：無號整數左移量仍必須小於提升後左運算元的位寬。`1u << 32` 在常見 32-bit unsigned int 上不是「得到零」，而是未定義行為。Python 的 int 可任意增大，和 C 固定寬度整數不同；把 Python 的位元運算翻譯成 C 時先決定要幾 bits 的範圍。

**練習：** 32-bit counter 原本值是 `UINT32_MAX`，再加 1 應該回到 0 還是報錯？答案由題目規格決定，不是由你看到它叫 unsigned 就直接決定。
