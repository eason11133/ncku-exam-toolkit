---
id: opt-pthread-join-vs-detach
title: pthread_join 與 pthread_detach：不能混用回收責任
category: Concurrency
tags: C, pthread_create, pthread_join, detach, lifetime
aliases: opt-pthread-join-vs-detach, pthread_join 與 pthread_detach
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_join.html
verified: false
updated_at: 2026-11-13
summary: 建立成功才 join；detach 之後不能再 join，不能讓使用者資料提前失效。
related: ncku-v2-pthread-thread-lifecycle
---

# 建立 Thread 後，誰負責確認它真的完成？

`pthread_create()` 只表示建立成功，不表示工作已完成。一般 joinable Thread 應由適當的 Thread `pthread_join()` 回收；Detached Thread 在完成後自動釋放相應執行緒資源，**不能再 join**。

## 完整 C11/POSIX 範例：先 join，再讀 worker 輸出

```c
#include <pthread.h>
#include <stdio.h>
#include <stdint.h>

typedef struct { int32_t input; int32_t output; } Job;

static void *calculate(void *arg) {
    Job *job = arg;
    job->output = job->input * 2; /* 這個測試範圍不會溢位 */
    return NULL;
}

int main(void) {
    Job job = {21, 0};
    pthread_t thread;
    if (pthread_create(&thread, NULL, calculate, &job) != 0) return 1;
    void *retval = NULL;
    if (pthread_join(thread, &retval) != 0) return 2;
    if (retval != NULL || job.output != 42) return 3;
    puts("join=ok output=42");
    return 0;
}
```

這個程式中 `job` 是 main 的區域變數，因為 main **先 join**，等 worker 完成後才離開作用範圍，所以 worker 存取時仍有效。若你把同樣的 `&job` 傳給 detached Thread，main 立刻返回或重新使用 `job`，就有失效指標或 data race 風險。

## Detached Thread 不代表「不用管完成」

Detach 只改變回收方式。系統若要安全關閉，還是得定義 worker 如何知道停止、最後工作何時完成、誰負責釋放共用 buffer。常見做法是使用 joinable workers、共享停止 predicate 和 Condition Variable；若真的 detach，應用程式也需要其他完成同步機制，不能試圖再 `pthread_join`。

**考場檢查**：建立返回碼、只 join 成功建立的執行緒、同一 Thread 不重複 join、參數資料的生命週期、worker 的錯誤結果與所有關閉路徑。記憶體無錯誤不代表同步已正確，必要時搭配合適的 race 檢查工具。

## 驗收範圍與限制

用相同 input 反覆執行並在 join 後讀 output；Detached 情況僅有原理說明，這份範例沒有實測 detach 的關閉流程。
