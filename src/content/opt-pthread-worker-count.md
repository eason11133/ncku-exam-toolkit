---
id: opt-pthread-worker-count
title: pthread Worker 數量與資料分片：保留尾端
category: Concurrency
tags: C, pthread, work partition, boundaries, performance
aliases: opt-pthread-worker-count, pthread Worker 數量與資料分片
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_create.html
verified: false
updated_at: 2026-11-13
summary: 工作分片要包含最後幾筆，Thread 數越多不一定越快。
related: ncku-v2-pthread-thread-lifecycle
---

# 切成 4 份，不代表每份剛好 n/4 筆

讓每個 Thread 做獨立的 `[begin,end)` 區間，不需要在每筆計算時搶全域鎖。但 `n` 不一定能整除 worker 數；如果每個 worker 固定做 `n / workers` 筆，尾端容易漏掉。

## 完整 C11/POSIX 範例：n=10，四個 worker

```c
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stddef.h>

#define WORKERS 4
#define N 10

typedef struct { size_t begin, end; int64_t sum; } Task;

static void *sum_range(void *arg) {
    Task *p = arg;
    int64_t total = 0;
    for (size_t i = p->begin; i < p->end; ++i)
        total += (int64_t)(i + 1);
    p->sum = total;
    return NULL;
}

int main(void) {
    pthread_t th[WORKERS];
    Task jobs[WORKERS];
    int made = 0;
    for (size_t i = 0; i < WORKERS; ++i) {
        jobs[i] = (Task){i * N / WORKERS, (i + 1) * N / WORKERS, 0};
        if (pthread_create(&th[i], NULL, sum_range, &jobs[i]) != 0) break;
        made++;
    }
    int failed = made != WORKERS;
    int64_t total = 0;
    for (int i = 0; i < made; ++i) {
        if (pthread_join(th[i], NULL) != 0) failed = 1;
        total += jobs[i].sum;
    }
    if (failed || total != 55) return 1;
    puts("partition=ok total=55");
    return 0;
}
```

`begin = i*n/workers`、`end=(i+1)*n/workers` 可涵蓋整個 `[0,n)`，且沒有空間重疊；即使 `n < workers`，部分區間會空，但不會憑空做多筆資料。若換成浮點加總，多 Thread 的合併順序可能影響末位誤差，需按題目容許誤差驗證。

## Worker 數怎麼決定

Linux 的 CPU 核心數不是越多越好。若工作是 I/O 等待，較多 worker 可能有用；若只是純運算，超過可用核心可能增加排程與 cache 成本。每筆工作很短、建立一次 Thread 卻只處理幾個元素，反而可能比單 Thread 慢。

先對照 1、2、4、8 workers 的**完整工作總時間**、正確性、CPU、峰值記憶體。建立失敗、n=0、n=1、n<workers 和不能整除的情境都要檢查。

## 驗收範圍與限制

額外用 n=0、n=1、n<workers 和不是 worker 整數倍的值測分片；文件裡的完整程式只固定測 n=10。
