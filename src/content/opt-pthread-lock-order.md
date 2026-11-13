---
id: opt-pthread-lock-order
title: 兩把 Mutex 統一取得順序，避免循環等待
category: Concurrency
tags: Concurrency, pthread-deadlock-order, 考場排查, 實作條件
aliases: opt-pthread-lock-order, 兩把 Mutex 統一取得順序，避免循環等待
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html
verified: false
updated_at: 2026-11-13
summary: 所有程式路徑都遵守固定鎖順序，不能只修一個 Thread。
related: ncku-v2-pthread-deadlock-order
---

# 兩條 Thread 都沒當掉，卻互相等到永遠

想像 A 已持有 `mu1` 又要 `mu2`，B 已持有 `mu2` 又要 `mu1`。如果兩者同時發生就有循環等待；再加更多 Thread 也不能解決。

## 完整 C11/POSIX：始終先鎖 a 再鎖 b

```c
#include <pthread.h>
#include <stdio.h>

static pthread_mutex_t a = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t b = PTHREAD_MUTEX_INITIALIZER;
static int left, right;

static void *worker(void *unused) {
    (void)unused;
    for (int i = 0; i < 1000; ++i) {
        pthread_mutex_lock(&a);
        pthread_mutex_lock(&b);
        ++left; ++right;
        pthread_mutex_unlock(&b);
        pthread_mutex_unlock(&a);
    }
    return NULL;
}
int main(void) {
    pthread_t p, q;
    if (pthread_create(&p, NULL, worker, NULL) != 0) return 1;
    if (pthread_create(&q, NULL, worker, NULL) != 0) return 2;
    if (pthread_join(p, NULL) || pthread_join(q, NULL)) return 3;
    if (left != 2000 || right != 2000) return 4;
    puts("both=2000");
    return 0;
}
```

這個完整範例讓兩條 Thread 都依同一順序操作；真正專案還要搜**全部拿鎖位置**，包含 callback、錯誤處理與關閉流程。只要有另一條路徑仍先拿 b 再拿 a，就還可能發生死鎖。

**驗收**：用 code search 列出每個 mutex 的取得順序；針對各 Thread 加隨機延遲反覆壓力測試，並用外部 timeout 檢查是否卡住。測試沒有卡住只能支持「暫時沒重現」，不能取代鎖順序的靜態推理。
## 死鎖為什麼不是「電腦剛好很慢」？

假設 Thread A 已拿到鎖 L1，想再拿 L2；Thread B 已拿 L2，想拿 L1。A 在等 B，B 在等 A，兩條都沒法繼續。這是循環等待，不是多開一條 Thread 就會好。

```text
A: lock L1  ✓       B: lock L2 ✓
A: lock L2  等待    B: lock L1 等待
         兩邊都不會走到 unlock
```

**固定順序的做法**：所有需要兩把鎖的路徑，先 L1 再 L2，釋放時反過來。如果每條路徑都遵守，前面那種「A 持有 L1 等 L2，同時 B 持有 L2 等 L1」的循環就不會發生。但也不能說整個程式沒有其他死鎖，例如 Callback 等待自己、Condvar predicate 錯誤、第三把鎖的順序沒一致等。

### `trylock` 和固定順序，選哪個？

固定鎖順序是能穩定重整時最容易證明的策略。`pthread_mutex_trylock` 則是「當下拿不到就回傳 `EBUSY`」，讓呼叫者可以釋放已持有鎖、退避、重排或回 Queue；它**沒有替你保證任務最後會被處理**。

例如收到工作 X，拿第二把鎖失敗就直接回傳成功，實際上 X 被丟了。要確認任務一定有後續：重新嘗試、有上限重試加錯誤回報，或重新排進可追蹤的 Queue。無上限 `sched_yield()` 不保證公平，也不一定比較省 CPU。

**測試時不要只問「還會不會卡住」**。還要確認每項工作各執行一次、錯誤時已拿的鎖都有釋放、關閉時所有 Worker 都能退出。

---

## 深讀：只要兩把鎖取得順序相反，就可能永遠卡住

看兩條 Thread 的時間軸：

| 時間 | Thread A | Thread B |
|---|---|---|
| 1 | 拿到 `lock_users` | 拿到 `lock_orders` |
| 2 | 想拿 `lock_orders`，開始等 B | 想拿 `lock_users`，開始等 A |
| 3 | A 不會放 `lock_users`，因為還在等另一把 | B 也不會放 `lock_orders` |

這就是典型的循環等待。**增加 Thread 數、加長 timeout 都不會根治順序矛盾。**

修法是先訂全域鎖順序，例如 `lock_users` 永遠先於 `lock_orders`；任何函式都遵守。遇到一個只有 `lock_orders` 的函式又要呼叫會拿 `lock_users` 的子函式，就要重新分析，不能只看表面函式的第一行。

### 那 `trylock` 就不會死鎖嗎？

它不會像 `lock()` 一樣在失敗當下等待，但如果失敗後忘了釋放**已拿到的鎖**，還是會讓別人卡住；若每次失敗都立刻再試，還可能忙等或活鎖。合理的回退必須交代：釋放哪些鎖、是否重新排程、工作能不能丟、重試有沒有上限。

**練習：** A 先拿 users 再拿 orders；B 先拿 orders 再拿 users；兩邊都沒有錯誤處理。如何修改？讓 B 改成 users → orders；而且所有呼叫路徑都要跟著遵守。這是**修正規則**，不是只替某一支測試程式加幾毫秒 `sleep`。
