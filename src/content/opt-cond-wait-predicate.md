---
id: opt-cond-wait-predicate
title: Condition Variable：while 檢查狀態再等待
category: Concurrency
tags: Concurrency, pthread-condition-queue, 考場排查, 實作條件
aliases: opt-cond-wait-predicate, Condition Variable：while 檢查狀態再等待
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_wait.html
verified: false
updated_at: 2026-11-13
summary: 避免把 pthread_cond_wait 的通知當成「資料一定已存在」，正確處理空佇列與關閉。
related: ncku-pthread-condvar-queue
---

# 等待「條件成立」，不是等待一聲通知

**什麼時候查這篇**：Consumer 沒資料時一直忙等、偶爾從空佇列取值，或收到了 `signal` 卻仍卡住。Condition Variable 的通知不保存次數，收到通知後，其他 Thread 也可能先取走工作；還可能發生虛假喚醒。所以要檢查的是共享 predicate，例如 `count > 0 || closed`。

## 完整 C11/POSIX 範例（可獨立編譯）

```c
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>

static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t cv = PTHREAD_COND_INITIALIZER;
static bool ready = false;
static int value = 0;

static void *producer(void *unused) {
    (void)unused;
    pthread_mutex_lock(&mu);
    value = 42;
    ready = true;
    pthread_cond_signal(&cv);
    pthread_mutex_unlock(&mu);
    return NULL;
}

int main(void) {
    pthread_t worker;
    if (pthread_create(&worker, NULL, producer, NULL) != 0) return 1;
    if (pthread_mutex_lock(&mu) != 0) return 2;
    while (!ready) {
        if (pthread_cond_wait(&cv, &mu) != 0) return 3;
    }
    int got = value;
    pthread_mutex_unlock(&mu);
    if (pthread_join(worker, NULL) != 0) return 4;
    if (got != 42) return 5;
    puts("value=42");
    return 0;
}
```

`pthread_cond_wait(&cv, &mu)` 會**原子地釋放 mutex 並等待**，返回時重新持有 mutex。`ready` 和 `value` 都必須由同一個 mutex 保護；signal 在鎖內發出是常用方式，不是 signal 本身讓資料安全。

## 如何放回 Queue

Queue Consumer 的邏輯是 `while (count == 0 && !closed) wait()`。醒來之後，若 `count > 0` 才 pop；若 `closed && count == 0` 才退出。Producer 必須持鎖更新 `count`，再適當通知。不要拿 `if (count==0)` 取代 `while`。

**驗收**：先測 Producer 比 Consumer 早開始、Consumer 先開始、兩個 Consumer 競爭同一筆、關閉時空佇列。檢查讀取筆數、順序、無忙等，以及結束時能 join。這個簡化程式只測單一值，不是多 Producer/Consumer 的完整 Queue。

**限制**：POSIX API 不等於 Windows 原生 Thread API；若沒有真正共享 predicate，單靠多發幾次 signal 仍然會遺失喚醒語意。

---

## 深讀：兩個 Consumer 搶同一筆，為什麼一定要 `while`？

先不要記 API，想像隊伍裡只有一張工作單，兩位工作者 A、B 都在等。

| 時刻 | Queue 的工作數 | A | B |
|---|---:|---|---|
| 1 | 0 | `cond_wait`，睡著 | `cond_wait`，睡著 |
| 2 | 1 | 被通知，但還沒拿到 mutex | 也可能被喚醒 |
| 3 | 0 | B 先拿到 mutex，把工作取走 | B 正在處理工作 |
| 4 | 0 | A 終於拿到 mutex；此時**仍然沒有工作** | 已離開臨界區 |

所以醒來只代表「你可以再檢查一次」，不代表 Queue 一定還有資料。即使只 `signal` 一人，也不能把通知當作工作交付的保證；POSIX 容許虛假喚醒，而且其他執行緒可能更早取走資料。

```c
/* 這是放進現有 Queue 實作的片段；mu 已持有、count/closed 受 mu 保護 */
while (count == 0 && !closed) {
    pthread_cond_wait(&not_empty, &mu);
}
if (count == 0 && closed) {
    /* 已關閉且工作做完：退出 */
} else {
    /* 此時在鎖內，才安全地 pop 一筆 */
}
```

請注意 `closed` 不代表「立刻丟掉剩下的工作」。這份流程選的是**把 Queue 中剩餘工作處理完再退出**；若題目要立即取消，才另外設計取消和丟棄規則。Producer 最後更新 `closed=true`，在同一把 mutex 保護下 `broadcast`，喚醒全部等待者。

**改錯練習：** 若把 `while` 改成 `if`，輸出偶爾正確，能說程式安全嗎？不能。只要存在上表第 3～4 步，就可能從空 Queue 取值；測 100 次沒出錯也不構成正確性證明。

**驗收要看什麼：** 用兩個 Consumer、20,000 筆有編號的工作；同一筆不能做兩次、不能漏任何一筆，關閉後兩位都能 `join`。本包 `quality_v9/examples/pthread_bounded_queue.c` 提供這種實測；不要把它和官方沒有 Queue 的 Demo 混為一談。
