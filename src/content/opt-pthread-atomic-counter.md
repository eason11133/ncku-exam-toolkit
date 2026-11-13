---
id: opt-pthread-atomic-counter
title: pthread 共用 Counter：Atomic 可以做什麼，不能做什麼
category: Concurrency
tags: pthread,C11,atomic,mutex,data race,counter
aliases: atomic_fetch_add,relaxed,原子計數器,counter race,多執行緒加總
source_type: personal
source_url: https://en.cppreference.com/w/c/atomic/atomic_fetch_add.html
verified: false
updated_at: 2026-11-13
summary: 提供完整 C11 pthread 範例，分清單一計數器、跨欄位一致性與 volatile 的限制。
related: ops-pthread-create-join
priority: P0
difficulty: intermediate
---

# `counter++` 為什麼會少算？

兩條執行緒都讀同一個舊值、各自加一再寫回，其中一次更新就可能被覆蓋。這是 Data Race 風險，在 C 記憶體模型中不是「偶爾少算、除此之外沒事」的合法保證。`volatile` 只影響某些存取最佳化，**不能取代 Atomic 或 Mutex**。

如果題目只有「最後總數要正確」這一個共享整數，C11 原子計數器很合適；如果要同時更新 `balance`、`transaction_count` 並保持兩個欄位一致，僅把它們分別改成 atomic 未必足夠，仍要分析同一筆操作的同步需求。

## 完整可編譯的 C11 + POSIX pthread 範例

```c
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <string.h>

#define ROUNDS 100000u
static atomic_uint total;

static void *worker(void *unused) {
    (void)unused;
    for (unsigned i = 0; i < ROUNDS; ++i)
        atomic_fetch_add_explicit(&total, 1u, memory_order_relaxed);
    return NULL;
}

int main(void) {
    atomic_init(&total, 0u);
    pthread_t a, b;
    int rc = pthread_create(&a, NULL, worker, NULL);
    if (rc != 0) {
        fprintf(stderr, "create A: %s\n", strerror(rc));
        return 1;
    }
    rc = pthread_create(&b, NULL, worker, NULL);
    if (rc != 0) {
        fprintf(stderr, "create B: %s\n", strerror(rc));
        (void)pthread_join(a, NULL);
        return 2;
    }
    int ja = pthread_join(a, NULL);
    int jb = pthread_join(b, NULL);
    if (ja != 0 || jb != 0) return 3;
    unsigned value = atomic_load_explicit(&total, memory_order_relaxed);
    printf("counter=%u\n", value);
    return value == 2u * ROUNDS ? 0 : 4;
}
```

儲存為 `atomic_demo.c` 後，Linux 指令：`gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic -pthread atomic_demo.c -o atomic_demo && ./atomic_demo`。預期 `counter=200000`。

這裡用 `memory_order_relaxed`，因為計數器只用來統計，每條 worker 完成後，主執行緒透過 `pthread_join()` 等待才讀總數。**如果計數器同時要代表「某一份資料已準備好」的通知，relaxed 不一定足夠**；需處理資料發布／可見性的同步關係。

## Atomic、Mutex、每條 Thread 自己算，怎麼選？

- 單一簡單更新、需要隨時可讀：Atomic 值得比較，但高競爭仍可能變慢。
- 一筆操作包含多個共享欄位、必須一起一致：用 Mutex 或其他能保護整個不變條件的設計。
- 只在全部執行緒結束後需要總和：每條 Thread 算自己的 `local`，`join` 後再加總，常能減少共享更新，但要檢查加總溢位與浮點數順序差異。

## 怎麼驗收

分別在 `-O0` 和 `-O2` 重跑，核對每次都是 200000。不要用「沒有重現錯誤」證明無鎖版安全；那個版本本來就有 data race。若加 TSan，需另外確認本機支援且不和 ASan 混用。比較效能前先驗證結果及實際 CPU 佔用。

---

## 深讀：同樣是 `counter++`，`volatile`、Atomic、Mutex 有什麼差？

假設 `counter=10`，A 和 B 都執行 `counter++`。在一般 C 表達式裡，這可能拆成「讀出 10 → 加成 11 → 寫回 11」。如果兩個 Thread 沒有同步，可能都讀 10，最後只剩 11；更嚴重的是，C 資料競爭屬於**未定義行為**，不能只拿「少算 1」當成唯一後果。

| 寫法 | 真正保證的事 | 沒有保證的事 |
|---|---|---|
| `volatile int counter` | 限制某些編譯器讀寫優化 | 不是跨 Thread 原子加法 |
| `_Atomic int counter` 搭配 `atomic_fetch_add` | 這次加法不可分割 | 不會自動保護另一個非原子的欄位 |
| `pthread_mutex_lock`／`unlock` | 同一把鎖保護的整段狀態更新 | 若別的程式繞過鎖讀寫，同樣不安全 |

例如銀行轉帳需要同時改 `balance_A`、`balance_B`，只把兩個欄位各改成 atomic，**未必**能保證另一個 Thread 看見兩個餘額是一致的交易狀態。這時整個「讀取、檢查、扣款、入帳」可能應受同一把 Mutex 保護。

如果題目只有一個單調增加的總次數，可用：

```c
#include <stdatomic.h>
_Atomic unsigned long counter = 0;
/* 多 Thread 使用：atomic_fetch_add_explicit(&counter, 1, memory_order_relaxed); */
```

`memory_order_relaxed` 對單一統計計數器可提供原子性，但**不**保證靠它發布另一塊資料的先後順序。若其他 Thread 要在看到旗標後讀完整資料，需要另設同步規則。

**自己判斷：** 「我要統計收到多少筆」和「我要在更新狀態後通知別人這批資料可讀」是同一題嗎？不是。前者可考慮單一 Atomic；後者需要確認資料的發布與可見性，不能只機械套 `relaxed`。
