---
id: ncku-v2-c-signed-overflow
title: C 的 Signed Overflow、Shift 與整數寬度
category: C Programming
tags: overflow, signed, shift, UB, 位元數
aliases: overflow,signed,shift,UB,位元數
source_type: personal
source_url: https://gcc.gnu.org/onlinedocs/gcc/Integers-implementation.html
verified: false
updated_at: 2026-11-12
summary: 程式在 -O0 正常、-O2 結果變掉，先檢查整數溢位與未定義行為。
related: 
priority: P0
difficulty: intermediate
---

# C 的 Signed Overflow、Shift 與整數寬度

## 遇到什麼情況要查這篇

程式在 -O0 正常、-O2 結果變掉，先檢查整數溢位與未定義行為。

## 先理解瓶頸

C 的 signed overflow 是未定義行為；左移 signed 負數、移位量大於等於位元寬度等也容易出錯。編譯最佳化會假設程式沒有未定義行為，因此不能用「我測幾次沒事」證明安全。

## 具體修改／排查示例

以下是可獨立編譯的 C11 範例。無號加法檢查用 `UINT32_MAX - a` 避免先溢位；有號加法則在運算前比較 `INT32_MAX - b` 或 `INT32_MIN - b`。兩者的規則不同。輸出指標為空時先拒絕，不能先解參照。

```c
#include <stdint.h>
#include <stdbool.h>
#include <limits.h>
#include <stddef.h>
#include <stdio.h>

bool add_u32(uint32_t a, uint32_t b, uint32_t *out) {
    if (out == NULL) return false;
    if (UINT32_MAX - a < b) return false;
    *out = a + b;
    return true;
}

bool add_i32(int32_t a, int32_t b, int32_t *out) {
    if (out == NULL) return false;
    if (b > 0 && a > INT32_MAX - b) return false;
    if (b < 0 && a < INT32_MIN - b) return false;
    *out = a + b;
    return true;
}

int main(void) {
    uint32_t u = 0;
    int32_t s = 0;
    if (!add_u32(UINT32_MAX - 1u, 1u, &u) || u != UINT32_MAX) return 1;
    if (add_u32(UINT32_MAX, 1u, &u) || add_u32(1u, 1u, NULL)) return 2;
    if (!add_i32(INT32_MAX - 1, 1, &s) || s != INT32_MAX) return 3;
    if (add_i32(INT32_MAX, 1, &s) || add_i32(INT32_MIN, -1, &s)) return 4;
    if (add_i32(0, 0, NULL)) return 5;
    puts("checked addition PASS");
    return 0;
}
```

## 可以嘗試的方案

### 1. 使用固定寬度無號型別

**做法**：明確表達位元運算與模數規則。

**先檢查**：規格本來就是無號語意。

**可能的代價**：不能拿無號混當負數。

**要保留**：邊界值一致。

### 2. 運算前做邊界檢查

**做法**：避免越界和未定義行為。

**先檢查**：溢位有明確處理策略。

**可能的代價**：多一點檢查成本。

**要保留**：不產生錯誤結果。

### 3. 用 sanitizer 與多種優化等級驗證

**做法**：抓編譯器假設下的隱藏問題。

**先檢查**：可以在本機重編譯。

**可能的代價**：sanitizer 本身會變慢。

**要保留**：正式版本不依賴未定義行為。

## 具體驗證流程

在 -O0、-O2 和 UBSan 下使用 INT_MAX、UINT32_MAX、負數與 shift 邊界測試，確認結果相同且沒有 sanitizer 報錯。若規格要求模 2^32，應使用無號型別並明示。

## 什麼情況不該用

不要以 -fwrapv 作為所有未定義行為的解法，它只處理某些 signed 溢位語意；還有越界、data race、移位等問題。

## 參考與查證狀態

- 參考：[GCC integer overflow](https://gcc.gnu.org/onlinedocs/gcc/Integers-implementation.html)
