---
id: opt-c-io-hotpath-logs
title: 把 C 熱路徑的逐筆 Logging 移出
category: C Programming
tags: C Programming, c-io-buffering, 考場判讀
aliases: opt-c-io-hotpath-logs, 把 C 熱路徑的逐筆 Logging 移出
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/io/setvbuf
verified: false
updated_at: 2026-11-13
summary: 查 CPU 很忙而程式卻慢時，先確認是不是每筆都在印 log。
related: ncku-v2-c-io-buffering
---

# 把 C 熱路徑的逐筆 Logging 移出

## 看到什麼問題

每個 element 都 `fprintf(stderr, ...)` 或 `printf`，資料一多便把終端機輸出、字串格式化與 I/O 包進熱路徑。**先量測**，不要看到 `printf` 就直接刪：考題可能要求輸出每筆結果。

## 修改前後

修改前（示意）：每筆計算後立刻印出 `debug: i=...`；正式輸出也混在同一條 `stdout`。修改後：計算維持不變，只把可選除錯輸出放在 `stderr`，由編譯旗標控制。

<!-- test: full-c -->
```c
#include <stdio.h>
static long work(int n) {
    long sum = 0;
    for (int i = 0; i < n; ++i) {
        sum += i;
#ifdef DEBUG_LOG
        fprintf(stderr, "debug i=%d sum=%ld\n", i, sum);
#endif
    }
    return sum;
}
int main(void) {
    if (work(100) != 4950) return 1;
    puts("answer=4950");
    return 0;
}
```

`gcc -std=c11 -O2 -DDEBUG_LOG ...` 才會印逐筆診斷；正式版不加 `-DDEBUG_LOG`。**不要**把正式評測要求的 `answer` 一起刪掉。

## 何時不適用／如何驗收

必須逐筆輸出的題目、需要稽核每個事件的業務流程，不能直接關 log。比對兩個編譯版本的 `stdout` 完全一致、`stderr` 可有差異；測總時間時將輸出端條件固定，避免「重導向與否」造成誤判。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/io/setvbuf
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。

## 延伸推演｜遇到變形題怎麼判斷

## 量測時開著大量 Log，可能量到的只是輸出成本

想像 Subscriber 每秒收到 5,000 筆，你在每次 callback 都輸出一行到終端機。處理本身可能只需要微秒，但終端機刷新、字串格式化和 I/O 都要時間；你量到的 callback 總耗時，會包含這些成本。

不要直接把 log 全部刪掉後就宣布「優化」。先看正式功能是否要求記錄某些事件；可改成只記錯誤、每隔固定筆數匯總，或將效能量測與除錯模式分開。比較兩版時，正式輸出與功能仍要相同；Debug log 是否允許改，按需求決定。

**變形：** 一開始的程式因為有 `printf`，兩條 Thread 很少撞在一起；移除 Log 之後突然計數錯。這不是 `printf` 幫你保護了資料，原本就有 Data Race。排除問題要靠同步，不是用輸出的時間差碰運氣。
