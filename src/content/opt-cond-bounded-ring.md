---
id: opt-cond-bounded-ring
title: 固定容量 Queue：滿載時正確背壓
category: Concurrency
tags: Concurrency, pthread-condition-queue, 考場排查, 實作條件
aliases: opt-cond-bounded-ring, 固定容量 Queue：滿載時正確背壓
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_wait.html
verified: false
updated_at: 2026-11-13
summary: 用 mutex、not_empty 和 not_full 管理固定容量，不以丟資料假裝變快。
related: ncku-pthread-condvar-queue
---

# Queue 滿了，先決定「要等，還是能丟」

**症狀**：Producer 速度長期超過 Consumer，記憶體持續增長；把 Queue 上限調小後卻遺失本來必須保留的資料。容量只是把問題變成明確的背壓，並不增加 Consumer 的計算能力。

## 完整 C11/POSIX：1 個 Producer、1 個 Consumer、容量 4

```c
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>

#define CAP 4
static int q[CAP], head, tail, count, sum;
static int seen[11]; /* single consumer writes, main reads after join */
static bool closed;
static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;
static pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;

static void *producer(void *unused) {
    (void)unused;
    for (int i = 1; i <= 10; ++i) {
        pthread_mutex_lock(&mu);
        while (count == CAP && !closed)
            pthread_cond_wait(&not_full, &mu);
        if (closed) { pthread_mutex_unlock(&mu); return NULL; }
        q[tail] = i; tail = (tail + 1) % CAP; ++count;
        pthread_cond_signal(&not_empty);
        pthread_mutex_unlock(&mu);
    }
    pthread_mutex_lock(&mu);
    closed = true;
    pthread_cond_broadcast(&not_empty);
    pthread_mutex_unlock(&mu);
    return NULL;
}
static void *consumer(void *unused) {
    (void)unused;
    for (;;) {
        pthread_mutex_lock(&mu);
        while (count == 0 && !closed)
            pthread_cond_wait(&not_empty, &mu);
        if (count == 0 && closed) { pthread_mutex_unlock(&mu); break; }
        int x = q[head]; head = (head + 1) % CAP; --count;
        pthread_cond_signal(&not_full);
        pthread_mutex_unlock(&mu);
        sum += x;  /* 本例只有一位 consumer 修改 sum */
        if (x >= 1 && x <= 10) ++seen[x];
    }
    return NULL;
}
int main(void) {
    pthread_t p, c;
    if (pthread_create(&c, NULL, consumer, NULL) != 0) return 1;
    if (pthread_create(&p, NULL, producer, NULL) != 0) {
        /* Producer 沒建立成功，不能留下 Consumer 永遠等資料。 */
        pthread_mutex_lock(&mu);
        closed = true;
        pthread_cond_broadcast(&not_empty);
        pthread_mutex_unlock(&mu);
        (void)pthread_join(c, NULL);
        return 2;
    }
    int jp = pthread_join(p, NULL);
    int jc = pthread_join(c, NULL);
    if (jp != 0 || jc != 0) return 3;
    if (sum != 55 || count != 0) return 4;
    for (int id=1; id<=10; ++id) if (seen[id] != 1) return 5;
    puts("sum=55 count=0 exact-once=ok");
    return 0;
}
```

此處也處理了 **Producer 建立失敗** 的情況：即使沒有工作進來，已建立的 Consumer 也必須接到關閉訊號並被回收。另外，兩個 `pthread_join()` 分開呼叫，避免用 `||` 短路後漏掉第二個。這個教學範例仍未涵蓋所有 pthread API 失敗情境；完整系統要逐項設計清理方式。

只看 `sum == 55` 仍有盲點。假如原本應該處理 `1、2、3`，錯誤程式卻處理 `2、2、2`，**總和同樣是 6**，但漏掉兩個 ID、重複處理一個 ID。上面新增 `seen[id]`，要求 1～10 每一筆都恰好出現一次。此處只有一位 Consumer，故 `seen` 可由它寫、Main 在 join 後讀；如果改成多位 Consumer，請用 Atomic 或在 Mutex 下更新，不能直接把這個普通陣列拿去讓多人同時 `++`。

本補充包另附 `tests/exact_once_queue.c`：三個 Consumer、512 筆工作，故意改變兩筆 ID 使 checksum 不變。正常版本通過，錯誤版本被逐筆驗證抓出。這是 Linux pthread 的測試模型，不是 ROS 2 Executor 實測。

這是**單 Producer、單 Consumer 的有限示範**。多 Consumer 同時修改 `sum` 時，還要額外同步或每人局部加總。更一般的程式必須檢查所有 pthread API 的返回碼、建立失敗後的停止流程。不能把這個簡化版本直接當作完整可恢復的伺服器。

## 要怎麼驗收

將 CAP 改成 1、2、4，對照 1 到 10 都剛好處理一次；再測 Producer 提早停止、空 Queue 關閉及高負載。`closed` 代表不再接受新工作，但 Consumer 必須先排空已有項目。若系統允許丟舊資料，應另訂明確政策並計數，不能不說明就跳過資料。
