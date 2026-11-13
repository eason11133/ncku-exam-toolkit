---
id: opt-transfer-short-poll
title: 短等待才考慮 Polling；volatile 不能替代 Atomic
category: DMA
tags: DMA, transfer-interrupt-or-poll, 考場排查, 實作條件
aliases: opt-transfer-short-poll, 短等待才考慮 Polling；volatile 不能替代 Atomic
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html
verified: false
updated_at: 2026-11-13
summary: 短輪詢可能減少切換成本，但 CPU 消耗與記憶體同步必須實測。
related: ncku-v2-transfer-interrupt-or-poll
---

# 忙等不一定錯，前提是等待非常短，並且同步正確

如果傳輸通常要數秒、數毫秒，CPU 一直 while loop 可能浪費大量核心時間；如果是極短且時間很敏感的等待，適度 Polling 才可能值得比較。**不能只看 `while (busy)` 看起來簡單就當它最佳。**

## 完整 C11/POSIX：用 Atomic 交換完成訊號

```c
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <sched.h>

static atomic_bool done = ATOMIC_VAR_INIT(0);
static int result;
static void *worker(void *unused) {
    (void)unused;
    result = 42;
    atomic_store_explicit(&done, 1, memory_order_release);
    return NULL;
}
int main(void) {
    pthread_t t;
    if (pthread_create(&t, NULL, worker, NULL) != 0) return 1;
    unsigned long polls = 0;
    while (!atomic_load_explicit(&done, memory_order_acquire)) {
        ++polls;
        if ((polls & 1023UL) == 0) sched_yield();
    }
    if (pthread_join(t, NULL) != 0) return 2;
    if (result != 42) return 3;
    puts("result=42");
    return 0;
}
```

這個例子用 release/acquire 保證讀到 `done=true` 後可正確看見先前寫入 `result`；**不是**在模擬 DMA 中斷／周邊寄存器，也沒有證明 Busy Polling 比 join 快。輪詢次數不是成本或吞吐量指標，CPU 占用必須另外量。

原 Demo 的 `volatile bool busy` 有跨 Thread data race 風險，應先修同步問題再比較；不要把 `volatile` 直接換進 `atomic_load` 就以為問題解決。若是真實 MMIO，需要硬體專用 API、memory barrier 與裝置文件，C 原子語意不能一概代替。

**驗收**：對照阻塞等待與輪詢的總完成時間、CPU 利用率、工作正確性與取消超時；對長等待應優先採用合適的阻塞或事件通知。
