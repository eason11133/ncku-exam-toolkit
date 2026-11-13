---
id: opt-pthread-cond-timeout
title: pthread_cond_timedwait：絕對時間、時鐘與返回碼
category: Concurrency
tags: Concurrency, pthread-timeout-shutdown, 考場排查, 實作條件
aliases: opt-pthread-cond-timeout, pthread_cond_timedwait：絕對時間、時鐘與返回碼
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_timedwait.html
verified: false
updated_at: 2026-11-13
summary: 逾時參數是絕對時間，不是相對等待毫秒；仍需在 mutex 下重檢 predicate。
related: ncku-v2-pthread-timeout-shutdown
---

# 逾時不是把 `timeout_ms` 直接傳進 API

`pthread_cond_timedwait(cond, mutex, abstime)` 要的是特定時鐘基準下的**絕對時間**。如果 Condition Variable 沒有額外設定時鐘，常見 POSIX/Linux 預設是 `CLOCK_REALTIME`；若用 `CLOCK_MONOTONIC` 計算 deadline，必須先用對應的 `pthread_condattr_setclock` 建立 Condition Variable。這兩種不能混用。

## 完整 C11/POSIX：等待 20 ms 或收到通知

```c
#define _POSIX_C_SOURCE 200809L
#include <pthread.h>
#include <time.h>
#include <errno.h>
#include <stdio.h>

static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t cv = PTHREAD_COND_INITIALIZER;
static int ready;

int main(void) {
    struct timespec limit;
    if (clock_gettime(CLOCK_REALTIME, &limit) != 0) return 1;
    limit.tv_nsec += 20000000L;
    if (limit.tv_nsec >= 1000000000L) {
        limit.tv_nsec -= 1000000000L;
        ++limit.tv_sec;
    }
    if (pthread_mutex_lock(&mu) != 0) return 2;
    int rc = 0;
    while (!ready && rc == 0)
        rc = pthread_cond_timedwait(&cv, &mu, &limit);
    int timed_out = (!ready && rc == ETIMEDOUT);
    pthread_mutex_unlock(&mu);
    if (!timed_out) return 3;
    puts("timeout=expected");
    return 0;
}
```

此例未啟動另一個 Producer，所以預期逾時。真實程式要區分 `rc==0`、`rc==ETIMEDOUT` 與其餘錯誤，並在每次被喚醒後檢查 predicate。若想使用單調時鐘，需顯式初始化 cond attribute；不是單純換 `clock_gettime` 的常數。

**驗收**：測極短逾時、已過的 deadline、通知比逾時早、通知與逾時接近、正常停止。排程可能使實際返回晚於指定時間；逾時不等於硬即時上限。若用多個 predicate，請在同一 mutex 下保持一致。
## 深讀延伸｜把原理放進真實情境
## `pthread_cond_timedwait` 的時間不是「等 N 毫秒」

`pthread_cond_timedwait` 的參數是**絕對截止時間**，不是「相對現在還有多久」。假設你要等 200 ms，不能傳一個 `tv_sec=0, tv_nsec=200000000` 就以為會等 200 ms；那表示從該 Condition Variable 選定的時鐘起算，非常早的時間點，通常立刻超時。

建立截止時間要先查此 condition variable 使用哪個 clock（常見預設是 `CLOCK_REALTIME`；若用 condattr 設了其他 clock，就要用相同 clock），再讀那個 clock 的現在時刻、加上相對時間、正規化 `tv_nsec`。等待返回也要分清 `ETIMEDOUT`、正常被喚醒及其他錯誤；就算正常被喚醒仍需要用 `while` 重查 predicate，因為可能虛假喚醒、也可能另一個 Consumer 先搶走工作。

**紙筆題：** 你在等 Queue 非空，但 100 ms 後逾時。返回 `ETIMEDOUT` 是否代表 Queue 此刻一定是空的？不能這樣假定；與其他 Thread 競爭時，要在持鎖情況下重新讀共享狀態並依工作規格處理。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：`timedwait` 不是「幫你等 N 毫秒」

`pthread_cond_timedwait` 的時間參數是**絕對截止時間**，不是相對等待秒數。要等最多 200 毫秒，你必須先讀取與這個 Condition Variable 設定一致的時鐘，再把 200ms 加到時間上，並處理 `tv_nsec` 進位。每次醒來若重新設定「從現在起再等 200ms」，不斷的假喚醒就可能把總等待時間拖得遠超預期。

回傳 `ETIMEDOUT` 也不能取代 predicate 檢查：在競爭邊界上，資源狀態可能恰好已變化。檢查的核心仍是**在 Mutex 下確認條件是否成立**，然後再看超時是否代表應退出。

**紙筆追一次：** 截止時間 10:00:00.200，10:00:00.150 被喚醒但 Queue 仍空。再次等待時應沿用 10:00:00.200，而不是延長為 10:00:00.350。若需要 `CLOCK_MONOTONIC`，應透過 `pthread_condattr_setclock` 正確初始化 CondVar；不能把 Monotonic 產生的 `timespec` 丟給預設採別的時鐘之 CondVar。

**驗收：** 測「工作早到」「精準截止附近到達」「沒有工作直到超時」「停止訊號」四個情境，並記錄 wall-clock 等待區間；時鐘、平台及調度會影響實測誤差，不保證毫秒級準時。
