---
id: opt-pthread-stop-broadcast
title: 關閉 Worker：先設停止狀態再 broadcast
category: Concurrency
tags: Concurrency, pthread-timeout-shutdown, 考場排查, 實作條件
aliases: opt-pthread-stop-broadcast, 關閉 Worker：先設停止狀態再 broadcast
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_wait.html
verified: false
updated_at: 2026-11-13
summary: 共享停止旗標要在 mutex 下更新；喚醒所有等待者後仍須 join。
related: ncku-v2-pthread-timeout-shutdown
---

# 已經停收工作，卻有 Thread 永遠無法結束？

當 Worker 卡在 `pthread_cond_wait()`，Main 只改一個全域 `stop = true`，不代表等待者會醒；在鎖外直接改非 atomic 旗標還可能造成 data race。停止流程須與 Consumer 的 predicate 一起設計。

## 完整 C11/POSIX 最小停止示範

```c
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>
static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t cv = PTHREAD_COND_INITIALIZER;
static bool stopping;

static void *worker(void *unused) {
    (void)unused;
    pthread_mutex_lock(&mu);
    while (!stopping)
        pthread_cond_wait(&cv, &mu);
    pthread_mutex_unlock(&mu);
    return NULL;
}
int main(void) {
    pthread_t a, b;
    if (pthread_create(&a, NULL, worker, NULL) != 0) return 1;
    if (pthread_create(&b, NULL, worker, NULL) != 0) return 2;
    pthread_mutex_lock(&mu);
    stopping = true;
    pthread_cond_broadcast(&cv);
    pthread_mutex_unlock(&mu);
    if (pthread_join(a, NULL) != 0 || pthread_join(b, NULL) != 0) return 3;
    puts("both joined");
    return 0;
}
```

這個例子刻意**沒有真實工作 Queue**，只示範停止 predicate。若第二次 `pthread_create` 失敗，完整產品程式應立即安全通知既有 Thread 並 join；範例未涵蓋這條錯誤恢復流程。

## 真實 Queue 需要額外定義的事

「停止接收新任務」和「立刻丟掉所有排隊任務」完全不同。若要 drain，Consumer 的迴圈是 `while (empty && !stopping) wait`，醒後先處理現有工作，只有 `empty && stopping` 才退出。若允許 discard，需要記錄丟棄幾筆。多種 Condition Variable（not_empty/not_full）時，也要喚醒每一種可能正在等的人。

**驗收**：停在 Worker 還未等到 cv、已等到 cv、已有工作、空工作、兩個以上 Worker 的情況；確認 join 會完成、沒有失去已承諾的結果。`broadcast` 不保證每個 Thread 立刻被排程執行。
