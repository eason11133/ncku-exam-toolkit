---
id: lesson-spinlock-critical-section-use-mutex
title: 比較 Mutex 是否更適合
category: Concurrency
tags: pthread_spin_lock, pthread Spinlock／Critical Section, 效能優化
aliases: use-mutex, spinlock-critical-section
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html
verified: false
updated_at: 2026-11-12
summary: 持鎖較久時避免持續忙等占滿 CPU。
related: ncku-pthread-critical-section
---

# 比較 Mutex 是否更適合

## 先弄懂這個問題

目前的方法是 **pthread Spinlock／Critical Section**。鎖保護共享變數，持鎖過久會使其他執行緒忙等。

這個方案的目的是：Mutex 爭用時可讓等待者睡眠，代價是阻塞／喚醒成本。

你可以先想像這個情境：臨界區偶爾需要等待 I/O，一直 spin 會空耗 CPU。

## 修改前：先看哪裡有問題

```c
pthread_spin_lock(&lock);
shared_count++;
pthread_spin_unlock(&lock);
```

## 修改後：對照實作

```c
pthread_mutex_lock(&mutex);
shared_count++;
pthread_mutex_unlock(&mutex);
```

## 逐步理解，為什麼這樣改

Spinlock 會反覆嘗試，Mutex 通常可讓等待者阻塞。選擇不是誰一定更快，而是考慮持鎖時間、競爭程度和執行環境。兩種鎖的初始化、銷毀及所有使用位置必須一起更換。

## 什麼情況才適合

- 執行緒之間需要互斥
- 沒有不能睡眠的中斷上下文要求

## 常見錯誤與代價

- 短鎖低爭用時未必更快
- 仍然可能死鎖或鎖競爭

**正確性界線：** 確認完整同步語意並測 CPU、總時間與正確性。

## 怎麼做測試

相同競爭負載下比較 CPU 使用率、等待時間與吞吐；檢查無死鎖、沒有漏解鎖。

優先觀察：CPU、總耗時、等待時間。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **counter lost update** 或 **共享 counter 讀寫競爭** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [POSIX pthread_mutex_lock](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html)
- [POSIX pthread_spin_lock](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_spin_lock.html)
