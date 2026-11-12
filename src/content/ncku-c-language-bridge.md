---
id: ncku-c-language-bridge
title: Python 轉 C：Struct、Header、Pointer、Callback、static 與 volatile
category: C Programming
tags: C, Python, struct, pointer, function pointer, static, volatile, header
aliases: struct, callback, .h .c, malloc, static, const
difficulty: intermediate
priority: P1
source_type: personal
source_url: https://en.cppreference.com/w/c/language.html
verified: false
updated_at: 2026-11-12
summary: 看懂官方 pthread 和 Transfer Engine 程式裡 Python 不常見的 C 語法。
related: ncku-c-memory, ncku-pthread-critical-section, ncku-transfer-engine
---
# Python 轉 C：只補陌生語法

你已經能用 Python 寫演算法，主要需要掌握 C 的記憶體及型別機制。

## `struct`：一組固定欄位

```c
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef struct {
    const void *src;
    void *dst;
    size_t count;
    bool src_increment;
} job_t;
```

在 Python 可以用 `dict` 把資料放一起；C 的 `struct` 欄位型別和記憶體布局由編譯器及 ABI 決定。`const void *src` 表示經這個指標不應修改來源資料，但**不保證其他程式不能修改它**。`void *dst` 是不指定目標型別的資料位址，使用時要知道實際記憶體格式。

## `*` 與 `&`

```c
int x = 7;
int *p = &x;    // &x 是 x 的位址
*p = 9;        // *p 透過位址修改 x
```

在 Python list/dict 常透過 reference 修改資料；C 的 `*p` 是明確解參照，若 `p` 是 NULL 或已失效位址，行為就不安全。

## `.h` 與 `.c`

`.h` 常放介面宣告：函式參數、struct、enum；`.c` 放實作。這讓呼叫端只要包含 header，就知道如何呼叫函式，但編譯時仍須把對應 `.c` 連結進去。

```c
// engine.h
int engine_claim(void);
// engine.c
int engine_claim(void) { /* ... */ return 0; }
```

Header 的函式宣告不會讓 `.c` 自動被編譯。Makefile 的 source list 要正確。

## `static`、`const`、`volatile` 的差別

- `static`：在函式內可延長局部變數的儲存期，在檔案作用域又常用來限制名稱只在目前翻譯單元可見；要看出現位置。
- `const`：限制透過該型別的修改，不等於執行緒安全。
- `volatile`：用於某些特殊可觀察的存取（例如記憶體映射 I/O 需結合平台規則），**不保證 atomic，也不解決 data race**。

## pthread 的 Function Pointer

```c
void *worker(void *arg) {
    (void)arg;
    return NULL;
}
// pthread_create(&th, NULL, worker, NULL);
```

這裡 `worker` 是函式，實作必須符合 `void *(*)(void *)` 的介面。`(void)arg;` 表示刻意沒用到參數，常用來避免未使用警告。Python 可以把函式直接傳給另一個函式，C 則使用函式指標完成類似目的。

## 小範例的界線

C 裡的 `sizeof(array)` 與 `sizeof(pointer)` 不一樣；`malloc` 的結果必須檢查 NULL；指標不能任意做越界加法；`uint32_t`、`size_t`、`NULL` 需要正確包含標頭檔。看懂每一段原始程式後再修改，而不是直接套用不同型別的片段。

來源：[C language reference](https://en.cppreference.com/w/c/language.html)、[POSIX pthread_create](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_create.html)。
