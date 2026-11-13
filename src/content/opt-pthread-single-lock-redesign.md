---
id: opt-pthread-single-lock-redesign
title: 跨兩把鎖的操作：減少鎖而不破壞一致性
category: Concurrency
tags: Concurrency, pthread-deadlock-order, 考場排查, 實作條件
aliases: opt-pthread-single-lock-redesign, 跨兩把鎖的操作：減少鎖而不破壞一致性
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html
verified: false
updated_at: 2026-11-13
summary: 同一交易需要多個欄位一致時，先定義不變條件，再選一把鎖或固定鎖順序。
related: ncku-v2-pthread-deadlock-order
---

# 少拿一把鎖，不代表資料就比較安全

**適用症狀**：一筆操作需同時改 `available` 與 `reserved`，原程式分別用不同鎖保護，導致中間狀態能被其他 Thread 看到，或需要兩把鎖時形成死鎖。

## 完整 C11/POSIX：將同一不變條件放在同一把鎖下

```c
#include <pthread.h>
#include <stdio.h>
static pthread_mutex_t balance_mu = PTHREAD_MUTEX_INITIALIZER;
static int available = 100, reserved = 0;
static void reserve_one(void) {
    pthread_mutex_lock(&balance_mu);
    if (available > 0) { --available; ++reserved; }
    pthread_mutex_unlock(&balance_mu);
}
static void *worker(void *unused) {
    (void)unused;
    for (int i = 0; i < 40; ++i) reserve_one();
    return NULL;
}
int main(void) {
    pthread_t a, b;
    if (pthread_create(&a, NULL, worker, NULL) != 0) return 1;
    if (pthread_create(&b, NULL, worker, NULL) != 0) return 2;
    if (pthread_join(a, NULL) || pthread_join(b, NULL)) return 3;
    if (available != 20 || reserved != 80 || available + reserved != 100) return 4;
    puts("invariant=100");
    return 0;
}
```

兩個欄位一起更新時，需要一個能保護**整組不變條件**的同步機制。如果想讓兩把鎖各自只鎖一半，其他 Thread 可能在中間讀到不一致狀態。這個範例只是說明重組方式，並不代表所有雙鎖設計都應合成一把大鎖。

**如何驗收**：列出跨欄位條件（例如 `available + reserved == 100`），在多組隨機並行操作後檢查；對照 lock contention 和吞吐量。若臨界區過長，單一 mutex 也可能變慢，要拿量測數據決定。
