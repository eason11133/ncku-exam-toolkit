---
id: opt-pthread-local-count-merge
title: 每個 Thread 自己計數，join 後合併
category: Concurrency
tags: Concurrency, pthread-atomic-counter, 考場判讀
aliases: opt-pthread-local-count-merge, 每個 Thread 自己計數，join 後合併
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/atomic
verified: false
updated_at: 2026-11-13
summary: 高頻共享加法可以改每條 Thread 局部加總，但必須定義合併時機。
related: ncku-v2-pthread-atomic-counter
---

# 每個 Thread 自己計數，join 後合併

## 不一定每次都要鎖

若總和只在工作完成後才需要，讓每條 Thread 累積自己的 `local`，`pthread_join` 後由主執行緒合併，可避免每次都競爭同一把鎖。這不適合每筆都要取得準確最新全域總和的流程。

## 完整 C11/POSIX

<!-- test: full-c -->
```c
#include <pthread.h>
#include <stdio.h>
typedef struct { long local; int repeat; } Task;
static void *worker(void *arg) {
    Task *t=arg;
    for (int i=0;i<t->repeat;++i) ++t->local;
    return NULL;
}
int main(void) {
    Task a={0,20000},b={0,20000};
    pthread_t x,y;
    if (pthread_create(&x,NULL,worker,&a)!=0) return 1;
    if (pthread_create(&y,NULL,worker,&b)!=0) { pthread_join(x,NULL); return 2; }
    if (pthread_join(x,NULL)!=0 || pthread_join(y,NULL)!=0) return 3;
    long total=a.local+b.local;
    if (total!=40000) return 4;
    printf("total=%ld\n",total);
    return 0;
}
```

這裡每個 Thread 寫入**不同 Task**，`join` 完才讀取結果，因此不需要保護同一個共享計數器。真正專案要注意 Overflow、Thread 建立失敗後已建立資源的清理、合併順序，還有錯誤分支不能把沒完成的 Task 直接相加。

**驗收**：空資料、奇數分片、N 小於 Thread 數、運算中錯誤與不同 Worker 數，與單執行緒總和逐項比較。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/atomic
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
