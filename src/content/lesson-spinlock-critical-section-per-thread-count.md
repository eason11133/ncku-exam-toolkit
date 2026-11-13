---
id: lesson-spinlock-critical-section-per-thread-count
title: Thread-local 累加、最後合併
category: Concurrency
tags: pthread_spin_lock, pthread Spinlock／Critical Section, 效能優化
aliases: per-thread-count, spinlock-critical-section
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/memory_model.html
verified: false
updated_at: 2026-11-12
summary: 若只需最後的計數總數，可每條執行緒先存在局部變數。
related: ncku-pthread-critical-section
---

# Thread-local 累加、最後合併

## 先弄懂這個問題

目前的方法是 **pthread Spinlock／Critical Section**。鎖保護共享變數，持鎖過久會使其他執行緒忙等。

這個方案的目的是：把每筆搶同一把鎖改成每個 worker 一次合併。

你可以先想像這個情境：多條 thread 每處理一筆就搶鎖做 `total++`。

## 修改前：先看哪裡有問題

```c
for (size_t i = start; i < end; ++i) {
    pthread_mutex_lock(&m);
    total += values[i];
    pthread_mutex_unlock(&m);
}
```

## 修改後：對照實作

```c
long local = 0;
for (size_t i = start; i < end; ++i) local += values[i];
pthread_mutex_lock(&m);
total += local;                // 每條 thread 只合併一次
pthread_mutex_unlock(&m);
```

## 逐步理解，為什麼這樣改

將 N 次共享更新改成每個 worker 一次合併，可減少鎖操作；前提是合併運算允許換序。整數溢位、浮點數相加順序可能影響答案，不能忽略。

## 什麼情況才適合

- 結果只需最後讀取
- 合併規則不改變業務語意

## 常見錯誤與代價

- 中途觀察值不再立即反映全部更新
- 多一段合併與額外記憶體

**正確性界線：** 需確保所有 worker 完成後再合併，並檢查 overflow。

## 怎麼做測試

用相同資料跑單執行緒正解、多執行緒舊版與新版；測 1、2、4、8 threads，檢查總和及尾端不足一塊的資料。

優先觀察：結果正確性、鎖等待、吞吐量。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


每筆更新共享 counter 都搶鎖、沒有逐筆即時公布的需求時，在各 worker 累加後安全合併；不能因此漏掉其他共享狀態。

## 參考文件與驗證狀態

- [C memory model](https://en.cppreference.com/w/c/language/memory_model.html)
- [POSIX pthread_mutex_lock](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html)
