---
id: opt-pthread-trylock-policy
title: trylock 遇到忙碌怎麼辦：釋鎖、退避與結果完整
category: Concurrency
tags: Concurrency, pthread-deadlock-order, 考場排查, 實作條件
aliases: opt-pthread-trylock-policy, trylock 遇到忙碌怎麼辦：釋鎖、退避與結果完整
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html
verified: false
updated_at: 2026-11-13
summary: trylock 避免永遠阻塞，但必須處理 EBUSY、釋放已持有資源及重新排程。
related: ncku-v2-pthread-deadlock-order
---

# `pthread_mutex_trylock` 失敗是正常路徑，不是直接跳過工作

`pthread_mutex_trylock` 在 Mutex 已被持有時通常回傳 `EBUSY`，不會替你等待。若程式在忙碌時直接 `return`，就把工作丟掉了。若已經持有另一把鎖，更要先釋放它再進行重試，否則可能還是卡住。

## 完整 C11/POSIX：不丟工作的 trylock 示範

```c
#include <pthread.h>
#include <errno.h>
#include <stdio.h>
#include <sched.h>
static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static int counter;
static int error_marker;
static void *worker(void *unused) {
    (void)unused;
    for (int i = 0; i < 1000; ++i) {
        int rc;
        while ((rc = pthread_mutex_trylock(&mu)) == EBUSY)
            sched_yield();  /* 示範退讓；生產程式不應無界空轉 */
        if (rc != 0) return &error_marker;
        ++counter;
        pthread_mutex_unlock(&mu);
    }
    return NULL;
}
int main(void) {
    pthread_t a, b;
    void *ra = NULL, *rb = NULL;
    if (pthread_create(&a, NULL, worker, NULL) != 0) return 1;
    if (pthread_create(&b, NULL, worker, NULL) != 0) { (void)pthread_join(a,NULL); return 2; }
    int ja=pthread_join(a,&ra), jb=pthread_join(b,&rb);
    if (ja!=0 || jb!=0) return 3;
    if (ra || rb || counter != 2000) return 4;
    puts("counter=2000");
    return 0;
}
```

這個範例只為了看懂 `trylock` 的返回碼：**不適合把無上限輪詢照搬到正式程式**。若原本允許阻塞，直接用 `pthread_mutex_lock` 通常更簡單；若要避免循環等待，可選擇固定鎖順序、有限次重試，或將失敗的工作送回有界 Queue。`sched_yield` 不能保證公平，也不解決飢餓。

**驗收**：同時測無競爭、強烈競爭、傳回非 EBUSY 錯誤；確認每項工作只執行一次，所有已取得的鎖在失敗路徑也能釋放。不要把「沒卡住」當成「沒有丟任務」。


### 實作邊界：兩次 `pthread_join` 請分別執行

`pthread_join(first) || pthread_join(second)` 在第一個回傳非零時會短路，第二個就不執行。這不是測試通過就能忽略的錯誤路徑。應分別呼叫兩次、保存返回碼，再一起判斷。若第二個 `pthread_create` 失敗，已建立的第一個 Thread 也要依工作生命週期妥善 join 或停止；**不能對建立失敗的 thread ID 執行 join**。此處是教學範例，沒有模擬每種 pthread API 故障，正式工作池仍需完整 shutdown 設計。
