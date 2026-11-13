---
id: opt-c-checked-signed-add
title: 安全的 int32 加法：先做範圍檢查
category: C Programming
tags: C, int32_t, bounds checking, UBSan
aliases: opt-c-checked-signed-add, 安全的 int32 加法
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/operator_arithmetic
verified: false
updated_at: 2026-11-13
summary: 不要先算再檢查 signed overflow；可先使用 int64_t 的足夠範圍做驗證。
related: ncku-v2-c-signed-overflow
---

# signed overflow：錯的是「先做完溢位再檢查」

如果你寫 `int result=a+b; if (result<a) ...`，`a+b` 本身可能已經溢位，檢查來不及。對兩個 `int32_t` 的加法，可先轉成 `int64_t` 做運算，再確認是否在 `INT32_MIN..INT32_MAX` 內。

## 完整 C11 範例：不依賴 assert

```c
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>

static bool add_i32(int32_t a, int32_t b, int32_t *out) {
    if (!out) return false;
    int64_t tmp = (int64_t)a + (int64_t)b;
    if (tmp < INT32_MIN || tmp > INT32_MAX) return false;
    *out = (int32_t)tmp;
    return true;
}

int main(void) {
    int32_t v = 17;
    if (!add_i32(3, 4, &v) || v != 7) return 1;
    if (add_i32(INT32_MAX, 1, &v)) return 2;
    if (add_i32(INT32_MIN, -1, &v)) return 3;
    if (v != 7) return 4; /* 失敗不覆寫 out */
    if (add_i32(4, 5, NULL)) return 5;
    puts("checked-add=ok");
    return 0;
}
```

這裡 64-bit 有號整數足以容納兩個 32-bit 有號數的總和，所以中間結果不會溢位。但若改成兩個 `int64_t` 加法，**不能再直接把中間型別當成一定夠寬**，需要用條件檢查或適用的 checked arithmetic API。

## 驗收

測正負極值、零、異號、兩端相同、NULL；並同時以 `-O0`、`-O2`、`-DNDEBUG`、UBSan 測試。特別要求：`-DNDEBUG` 不可讓必要測試全部消失，所以此範例使用明確 `if` 和返回碼，而不是 `assert()` 當唯一檢驗。

---

## 深讀：位元算式看起來能跑，也可能是 C 的未定義行為

假設你要做 `a+b`，a、b 都是 `int`。如果 `a=INT_MAX`、`b=1`，結果超過 `int` 能表示的最大值。C 的**有號溢位未定義**；不能把「我的電腦印出負數」當成語言保證。編譯器在 `-O2` 甚至可能依「不會發生未定義行為」的前提做最佳化，讓你觀察到不同結果。

安全做法是先看「會不會超界」，再做加法：

```c
/* 正數 b 時：a > INT_MAX - b 就不能安全相加。 */
/* 負數 b 時：a < INT_MIN - b 就不能安全相加。 */
```

這兩項檢查本身也要避免溢位：在 `b>0` 時 `INT_MAX-b` 安全；在 `b<0` 時 `INT_MIN-b` 安全。若題目本來要求「模 2^32」語意，應用 `uint32_t` 之類無號型別，而不是把 signed overflow 當作無號環繞。

**反例：** 把所有 `int` 換成 `unsigned` 就萬事大吉嗎？不行。`-1` 在無號語意下不等於 -1，還可能在索引、長度比較及位元移位造成其他錯誤。

**考場題：** 給 `a=INT_MIN`、`b=-1`，`a+b` 可不可以直接做？不可。請先判斷 `INT_MIN - (-1)` 的界線比較是否合適，而不是先算出超範圍結果再回頭處理。
