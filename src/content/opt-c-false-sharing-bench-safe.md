---
id: opt-c-false-sharing-bench-safe
title: False Sharing：兩個不同變數也可能爭同一個 Cache Line
category: Performance Engineering
tags: Performance Engineering, cpu-memory-locality, 考場判讀
aliases: opt-c-false-sharing-bench-safe, False Sharing：兩個不同變數也可能爭同一個 Cache Line
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/language/object
verified: false
updated_at: 2026-11-13
summary: 先測到 cache-line 爭用，再決定是否對齊或 Padding。
related: ncku-memory-locality
---

# False Sharing：兩個不同變數也可能爭同一個 Cache Line

## 容易混淆的地方

多條 thread 各改**不同變數**不一定有 data race，但如果變數落在同一個 cache line，跨核心更新可能造成 cache line 反覆搬移，降低吞吐。這叫 False Sharing。它和未加鎖同時修改同一變數的 Data Race 不同。

## 完整 C11/POSIX（只驗功能）

<!-- test: full-c -->
```c
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdint.h>
typedef struct { _Alignas(64) atomic_uint_fast64_t n; } Counter;
static Counter counters[2];
static void *run(void *p) {
    int id = *(int *)p;
    for (int i=0;i<10000;++i)
        atomic_fetch_add_explicit(&counters[id].n, 1u, memory_order_relaxed);
    return NULL;
}
int main(void) {
    pthread_t t[2]; int ids[2]={0,1};
    atomic_init(&counters[0].n,0);
    atomic_init(&counters[1].n,0);
    if (pthread_create(&t[0],NULL,run,&ids[0])!=0) return 1;
    if (pthread_create(&t[1],NULL,run,&ids[1])!=0) { (void)pthread_join(t[0],NULL); return 2; }
    int j0=pthread_join(t[0],NULL), j1=pthread_join(t[1],NULL);
    if (j0!=0 || j1!=0) return 3;
    uint_fast64_t a=atomic_load(&counters[0].n),b=atomic_load(&counters[1].n);
    if (a!=10000 || b!=10000) return 4;
    puts("two counters=10000 each"); return 0;
}
```

### 為什麼這支程式只能算正確性測試？

目前的範例只有**已做 Padding／對齊**的 Counter，沒有一組「兩個 Counter 擠在同一 Cache Line」的對照組，也沒有測量時間。因此印出 `two counters=10000 each` 最多證明每條 Worker 的計數正確，**完全不能證明 False Sharing 曾發生，或對齊改善多少速度**。

真正的實驗要有兩個布局、相同執行緒數與工作量、固定每個 Worker 更新的不同欄位；先確認結果相同，再用重複量測比較。可先印 `sizeof`、`_Alignof`、兩筆 Counter 的位址差，檢查配置形式；但即使位址符合預期，兩條 Thread 可能跑在同核心，也可能被排程打斷，效能結果仍需看實際 CPU／Cache Line 大小。不能把單次耗時當成可移植的性能結論。

`64` 只是常見但**非所有 CPU 的 cache line 大小**，這裡只示範明確對齊；兩個版本的記憶體占用和效能需在目標 CPU 實測。對齊會增加空間；只有真的有高頻跨核心寫入、測得爭用，才值得使用。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/language/object
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。


### 實作邊界：兩次 `pthread_join` 請分別執行

`pthread_join(first) || pthread_join(second)` 在第一個回傳非零時會短路，第二個就不執行。這不是測試通過就能忽略的錯誤路徑。應分別呼叫兩次、保存返回碼，再一起判斷。若第二個 `pthread_create` 失敗，已建立的第一個 Thread 也要依工作生命週期妥善 join 或停止；**不能對建立失敗的 thread ID 執行 join**。此處是教學範例，沒有模擬每種 pthread API 故障，正式工作池仍需完整 shutdown 設計。
