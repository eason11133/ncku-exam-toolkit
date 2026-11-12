---
id: ncku-concurrency-advanced
title: 同步延伸：Atomic、Mutex、Condition Variable、Semaphore 與 Deadlock
category: Concurrency
tags: pthread, mutex, atomic, condvar, semaphore, deadlock
aliases: pthread_cond_wait, data race, atomic, 鎖, 死結
difficulty: advanced
priority: P1
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_wait.html
verified: false
updated_at: 2026-11-12
summary: 在 Spinlock 之外，知道如何選擇等待、通知與互斥工具，避免誤把忙等當快速。
related: ncku-pthread-critical-section
---
# 同步工具怎麼選

同一個共享資料被多個 Thread 修改時，先分析正確性：誰可以讀、誰可以寫、哪些操作必須一起完成。不同工具解決的問題不同。

| 工具 | 適合什麼 | 注意 |
|---|---|---|
| Mutex | 保護需要一起更新的共享狀態 | 鎖可能等待，仍需避免死結 |
| Spinlock | 極短臨界區、適合忙等的環境 | 等待時一直消耗 CPU，鎖內不能阻塞 |
| Atomic | 單一變數的指定原子操作 | 記憶體順序及跨變數不變條件須確認 |
| Condition Variable | 等某個條件成立再被通知 | 要和 Mutex、predicate 一起使用，且用 while 重查條件 |
| Semaphore | 限制資源數量或傳達可用數量 | 不是任意複雜共享狀態的一般互斥替代品 |

## Condition Variable 不是只呼叫 `wait()`

```c
pthread_mutex_lock(&mu);
while (!ready) {                       // 用 while，醒來後再檢查 predicate
    pthread_cond_wait(&cv, &mu);        // 原子地釋放 mu 並等待；返回前重拿 mu
}
consume_shared_data();                // 此時仍持有 mu
pthread_mutex_unlock(&mu);
```

這段是**程式片段**，需有已初始化的 `mu`、`cv`、`ready` 等變數。等待另一方通常是在拿到同一把 Mutex 後更新 `ready`、通知，並保證資料可見性。用 `if` 代替 `while` 可能因 spurious wakeup 或其他 consumer 先消費而出錯。

## 什麼是 Deadlock

A 先拿 Lock 1 等 Lock 2；B 先拿 Lock 2 等 Lock 1，彼此永遠等不到。常見修法是統一鎖的取得順序、減少同時持有多把鎖，或重設共享資料操作。ROS 2 也可能因 Callback Group + 同步 service call 配置形成死結。

## Atomic 不代表所有更新都安全

如果只需要單一計數器：

```c
#include <stdatomic.h>
atomic_uint counter = 0;
atomic_fetch_add(&counter, 1u);
```

這段只保護 `counter` 自己的操作。假設兩個欄位必須一起符合某個規則，就不能只把其中一個改成 atomic。也不能機械式把所有 memory order 改成 relaxed。

## 測試順序

以一個正確的 Mutex baseline 為準，任何更換 Spinlock／Atomic／Condition Variable 的做法，都要在多執行緒壓力和不同負載下測正確性、CPU、RSS、等待時間，再看是否值得保留。

來源：[POSIX pthread_cond_wait](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_wait.html)、[C atomics](https://en.cppreference.com/w/c/atomic/atomic_fetch_add.html)、[ROS 2 Callback groups](https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html)。
