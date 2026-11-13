---
id: opt-pthread-fixed-worker-pool
title: 固定 pthread Worker：避免每筆工作都 create/join
category: Concurrency
tags: C, pthread, fixed workers, join, mutex
aliases: opt-pthread-fixed-worker-pool, 固定 pthread Worker
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_create.html
verified: false
updated_at: 2026-11-13
summary: 建立少量長壽命 worker 反覆取工作，注意共享 next index 和最後 join。
related: ncku-v2-pthread-thread-lifecycle
---

# pthread_create 的成本：反覆建 Thread 不一定值得

如果每筆短工作都 `pthread_create`，立即 `pthread_join`，實際可能變成逐筆序列化加上大量建立／回收成本。先考慮建立固定數量 worker，讓它們重複拿工作；但拿下一筆任務的共享狀態必須有同步。

## 完整 C11/POSIX 範例：兩個 worker 分配 1..100 工作

```c
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>

#define THREADS 2
#define TASKS 100

static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static int next_task = 1;
static int worker_error_marker;
static int64_t partial[THREADS];

static void *worker(void *arg) {
    int id = *(int *)arg;
    int64_t local = 0;
    for (;;) {
        int task;
        if (pthread_mutex_lock(&mu) != 0) return &worker_error_marker;
        task = next_task <= TASKS ? next_task++ : 0;
        if (pthread_mutex_unlock(&mu) != 0) return &worker_error_marker;
        if (task == 0) break;
        local += (int64_t)task * task;
    }
    partial[id] = local; /* 不同 worker 寫不同 index；main 在 join 後讀 */
    return NULL;
}

int main(void) {
    pthread_t th[THREADS];
    int ids[THREADS] = {0, 1};
    int made = 0;
    for (int i = 0; i < THREADS; ++i) {
        if (pthread_create(&th[i], NULL, worker, &ids[i]) != 0) break;
        made++;
    }
    int bad = made != THREADS;
    int64_t total = 0;
    for (int i = 0; i < made; ++i) {
        void *status = NULL;
        int join_rc = pthread_join(th[i], &status);
        if (join_rc != 0) { bad = 1; continue; }
        if (status != NULL) { bad = 1; continue; }
        total += partial[i];
    }
    if (bad || total != 338350) return 1;
    puts("worker-pool=ok total=338350");
    return 0;
}
```

此程式不是含等待佇列與關閉訊號的正式通用 Thread Pool：它用兩個固定 worker，在一批工作中反覆取下一個任務。要支援長期接收工作，還要增加 bounded queue、Condition Variable、shutdown 和背壓。

## 正確性界線

`next_task++` 由 mutex 保護；每個 worker 的 local 只由自己寫；主執行緒在所有 join 後才讀結果。建立部分失敗時，只 join 成功建立的 Thread。**join 成功，才是主執行緒可以讀取 worker 最終結果的前提。** 原稿在 join 失敗時仍讀 `partial[i]`，有機會在 worker 還在寫入時碰到資料競爭；改成 `continue` 跳過讀取。不過這只是示例的錯誤處理：完整服務若 join 失敗，還必須設計避免在 worker 仍活著時釋放其使用的資源。

還要分清 `pthread_create` 失敗與工作本身失敗。前者代表那個 Thread **從未成立**，不能對未建立的 `pthread_t` 呼叫 join；後者則要由已成立 Thread 回傳狀態，join 之後檢查。若共享工作還包括其他狀態，不能只保護 next index 就宣稱無 race。比較效能時固定工作量及 worker 數，別把初始化的時間偷藏到測量範圍之外。

## 驗收範圍與限制

測 1、2、4 個 worker、0/1/100 筆工作；此範例固定 2 worker，只驗證固定情境。錯誤注入需另測 create 失敗。
