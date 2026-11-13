---
id: ops-pthread-create-join
title: pthread_create、pthread_join 和資料生命週期：完整 C 範例
category: 操作與除錯
tags: pthread,thread,join,create,C,concurrency
aliases: 執行緒建立,等待執行緒,Thread, pthread_create, pthread_join
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_create.html
verified: false
updated_at: 2026-11-13
summary: 先讀懂執行緒建立、等待和參數生命週期，再處理共享狀態與鎖。
related: ncku-pthread-critical-section,ops-gcc-compile-link
---

# 先區分「建立」與「等待」

`pthread_create()` 建立執行緒，讓它執行指定的 `void *worker(void *)` 函式。`pthread_join()` 等某個可 join 的執行緒結束，等待後主程式才能安全取得它已寫完的結果。單純呼叫 `pthread_create` 後，不可以立即假設結果已算好。

你在 Python 熟悉把函式丟給其他流程；C 特別要注意傳給 Worker 的**指標所指資料仍須有效**。不能在迴圈裡把同一個反覆改變的區域變數位址交給所有 Thread，然後假設每條執行緒讀到的值都不同。

## 完整 POSIX C11 範例（可在支援 pthread 的 Linux 編譯）

```c
#include <pthread.h>
#include <stdio.h>
#include <string.h>

typedef struct {
    int begin;
    int end;
    long long result;
} Task;

static void *worker(void *arg) {
    Task *task = arg;
    long long sum = 0;
    for (int i = task->begin; i < task->end; ++i) {
        sum += i;
    }
    task->result = sum;
    return NULL;
}

int main(void) {
    Task tasks[2] = {{0, 5, 0}, {5, 10, 0}};
    pthread_t threads[2];
    int created = 0;

    for (int i = 0; i < 2; ++i) {
        int rc = pthread_create(&threads[i], NULL, worker, &tasks[i]);
        if (rc != 0) {
            fprintf(stderr, "pthread_create: %s\n", strerror(rc));
            break;
        }
        ++created;
    }

    int join_failed = 0;
    for (int i = 0; i < created; ++i) {
        int rc = pthread_join(threads[i], NULL);
        if (rc != 0) {
            fprintf(stderr, "pthread_join: %s\n", strerror(rc));
            join_failed = 1;
        }
    }
    if (created != 2 || join_failed) return 1;

    long long total = tasks[0].result + tasks[1].result;
    printf("total=%lld\n", total);
    return total == 45 ? 0 : 1;
}
```

在 Linux 下：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic -O2 -pthread main.c -o app
./app
```

`main.c` 是你放入上面完整程式的檔名；輸出應為 `total=45`。此例兩條執行緒只改寫各自 `tasks[i].result`，主執行緒在 `join` 後才讀，沒有多條執行緒同時累加同一個 `total`。這段示範資料分工的**正確性**，不聲稱用兩條 Thread 比單執行緒更快（這麼小的計算通常不值得啟動執行緒）。

## 哪些地方不能照抄？

`pthread_create`、`pthread_join` 都以返回碼回報錯誤：**不能只靠 `errno` 判斷**。如果題目有共享佇列、共享 counter 或不同 worker 同時修改一個陣列元素，就要另外檢查 Mutex、Atomic 或資料分區。`volatile` 不是執行緒同步工具。多條執行緒的結果正確，也不表示沒有潛在 data race。

參考：[POSIX pthread_create](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_create.html)、[POSIX pthread_join](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_join.html)。
