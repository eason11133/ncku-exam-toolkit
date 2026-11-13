---
id: opt-c-reuse-scratch
title: 重用暫存 Buffer：初始化、別名與生命週期
category: C Programming
tags: C, malloc, buffer reuse, lifetime
aliases: opt-c-reuse-scratch, 重用暫存 Buffer
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/memory/malloc
verified: false
updated_at: 2026-11-13
summary: 重用短命暫存空間時先保證每次初始化、沒有其他讀者保留指標。
related: ncku-v2-c-allocator-fragmentation
---

# 重用 Buffer 最怕「上一筆資料還在裡面」

若每筆工作都建立一塊一樣大的暫存陣列，可能花很多時間在 `malloc/free`。可以把配置移到迴圈外，但這要求 `process()` 不保留該指標，且每筆都會寫滿**所有需要讀的範圍**。

## 完整 C11 範例：初始化後才讀

```c
#include <stdlib.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static int compute(uint8_t *tmp, size_t n, uint8_t seed) {
    memset(tmp, 0, n); /* 若演算法會讀未寫位置，就要初始化 */
    for (size_t i = 0; i < n; ++i)
        tmp[i] = (uint8_t)(seed + (uint8_t)i);
    unsigned total = 0;
    for (size_t i = 0; i < n; ++i) total += tmp[i];
    return (int)total;
}

int main(void) {
    const size_t capacity = 16;
    uint8_t *scratch = malloc(capacity);
    if (!scratch) return 1;
    int first = compute(scratch, capacity, 1);
    int second = compute(scratch, capacity, 2);
    if (first != 136 || second != 152) { free(scratch); return 2; }
    puts("scratch=ok");
    free(scratch);
    return 0;
}
```

這段測試特意兩次寫入同一塊記憶體；如果實際 `process()` 把指標放進 Queue、在非同步執行緒使用，迴圈不能直接覆寫它，必須等上一個讀者完成。這個範例沒有其他 thread，所以不代表跨執行緒重用已被驗證。

## 是否該使用

當暫存容量固定、處理是同步完成、成本主要在重複配置時適合。若每次資料都非常小，重用的收益可能少；若容量差異很大，保持高水位的大 buffer 也可能提高記憶體占用。若內容含機密資料，不能因為重用而忘記清理必要位置。

**考場驗收**：不同 seed 連續呼叫、故意縮短有效長度、套 ASan、確認呼叫端沒有保存舊指標；量整段工作時間，不只 `malloc` 一行。
