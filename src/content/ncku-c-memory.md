---
id: ncku-c-memory
title: C 記憶體：指標、緩衝區、對齊和安全複製
category: Memory Management
tags: pointer, buffer, memcpy, memmove, alignment, sizeof, uint32_t
aliases: 位址, 越界, 指標, 記憶體複製, calloc
difficulty: intermediate
priority: P1
source_type: personal
source_url: https://en.cppreference.com/w/c/string/byte/memcpy.html
verified: false
updated_at: 2026-11-12
summary: 看懂 Transfer Engine 使用的來源／目的位址、傳輸筆數及 buffer 安全條件。
related: ncku-transfer-engine, ncku-bitwise-c
---
# C 指標與 Buffer：Transfer Engine 的真正前提

在 Python 中，list 管理長度與記憶體；C 的 `uint32_t *p` 是指向 32 位整數的位址，**它不會自動告訴你整段 buffer 多大**。如果程式要複製 4096 個 32 位整數，目的地至少需要 `4096 * sizeof(uint32_t)` bytes 的有效可寫空間。

```c
#include <stdint.h>
#include <string.h>

uint32_t src[4] = {10, 20, 30, 40};
uint32_t dst[4] = {0};
memcpy(dst, src, sizeof src);
```

`sizeof src` 在這個區域內是整個陣列的 bytes；但如果把陣列當參數傳進函式，參數中的 `src` 通常退化成指標，`sizeof src` 就不再是原陣列長度。這是常見越界原因。

## `memcpy` 與 `memmove`

- `memcpy`：來源與目的範圍**不得重疊**，通常適合彼此獨立的 buffer。
- `memmove`：來源與目的可重疊，會處理必要的移動順序；可能有額外成本。
- 指標運算的單位跟著型別走：`uint32_t *p; p+1` 前進的是一個 `uint32_t`，不是一個 byte。

## 動態配置與錯誤路徑

```c
#include <stdlib.h>
#include <stdint.h>

size_t n = 4096;
if (n > SIZE_MAX / sizeof(uint32_t)) return 1;  // 避免乘法 overflow
uint32_t *dst = malloc(n * sizeof *dst);
if (dst == NULL) return 1;
/* 使用 dst */
free(dst);
```

如果 DMA／軟體 Transfer Engine 尚在搬運，不能先 `free(src)`、`free(dst)`，也不能任意改變 buffer 內容。若涉及實體 DMA，還要依平台文件確認對齊、cache coherent 與記憶體可見性。

## 效能問題怎麼看

避免重複配置／複製可能節省時間和記憶體，但變成共享同一塊 buffer 後，會有生命週期與資料競爭問題。零拷貝（zero-copy）也不是任何 ROS 2 傳輸都能直接啟用；應確認 API、Middleware 與記憶體所有權。

來源：[memcpy](https://en.cppreference.com/w/c/string/byte/memcpy.html)、[memmove](https://en.cppreference.com/w/c/string/byte/memmove.html)、[malloc](https://en.cppreference.com/w/c/memory/malloc.html)。
