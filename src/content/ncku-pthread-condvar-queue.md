---
id: ncku-pthread-condvar-queue
title: pthread 等待與 Queue：Condition Variable、Ring Buffer、Backpressure
category: Concurrency
tags: pthread, mutex, condition variable, producer consumer, queue, bounded buffer
aliases: busy wait, 忙等, 條件變數, 有界佇列, 消費者生產者
source_type: personal
source_url: https://man7.org/linux/man-pages/man3/pthread_cond_wait.3p.html
verified: false
updated_at: 2026-11-12
summary: 工作尚未到達時別讓執行緒空轉；用 condition variable 等待，並明確定義 queue 滿與關閉時的行為。
related: ncku-pthread-critical-section, ncku-concurrency-advanced
priority: P0
difficulty: intermediate
---

# Queue 沒資料時，為什麼 CPU 還一直跑？

## 看懂瓶頸

想像有兩個 pthread：Producer 收資料放進 Queue，Consumer 取出處理。若 Consumer 這樣寫：

```c
while (running) {
    if (queue_has_data()) {
        process_one();
    }
}
```

即使 Queue 沒資料，`while` 仍不停執行。這叫 **Busy Waiting（忙等）**。若 `queue_has_data()` 沒有同步保護，還可能有 data race，甚至不只是浪費 CPU。

比較好的思路是讓沒有資料的 Consumer **睡著等待條件改變**，有資料時再喚醒。

## 方案 A：Condition Variable + Mutex

Condition Variable（條件變數）本身**不儲存工作**，只負責通知「某個條件可能改變了」。真正的狀態仍存在 Queue，且必須用 Mutex 保護。

```c
pthread_mutex_lock(&q.mu);
while (q.count == 0 && !q.closed) {
    pthread_cond_wait(&q.not_empty, &q.mu);
}
/* 醒來後仍持有 q.mu，此時重新檢查 count / closed */
pthread_mutex_unlock(&q.mu);
```

`pthread_cond_wait` 會暫時放開 Mutex，讓 Producer 可以放資料；重新醒來時再取得 Mutex 才會返回。

為什麼一定要 `while`，不是 `if`？因為喚醒不保證條件已經成立（包含 spurious wakeup，也可能另一個 Consumer 已經先取走資料），必須重新檢查共享狀態。

## 方案 B：有界 Ring Buffer，避免資料無限制累積

假設 Producer 每秒送 200 筆，Consumer 每秒只處理 50 筆，無上限 Queue 會一直長大。要決定 Queue 滿時的政策：

- **不可丟的工作**：Producer 等待空位，形成 Backpressure（背壓），降低上游速度。
- **只要最新狀態**：可考慮覆蓋舊資料，但必須先確認丟資料不會破壞正確性。
- **可以擴展處理能力**：再評估多 Consumer，不代表一定能線性加速。

Ring Buffer 用固定長度陣列、`head`（下次讀位置）、`tail`（下次寫位置）、`count`（目前筆數）。更新這三個欄位時，都必須有同步保護。

目前專案未附原文所稱的 `examples/pthread_bounded_queue.c`，因此這裡只說明設計條件，不宣稱已有可編譯的完整示範或特定執行結果。上面的 pthread 程式碼是等待條件的片段；完整實作仍需補齊共享狀態、Producer／Consumer 函式、有界佇列容量、`not_empty`／`not_full` 的訊號與安全關閉流程。這也不是成大 2-3 Transfer Engine 的同步範本。

## 方案 C：有很多細小任務時，評估批次取出

每筆工作都鎖一次、喚醒一次，成本可能偏高。Consumer 可以在鎖內先取出少量工作放到自己的區域 buffer，**解鎖後**再計算。但要保證取出與 `count` 更新一致，且不要在鎖內做耗時計算。

批次可能提升吞吐量，但會讓第一筆等到收滿一批才處理；如果要求低延遲，就應該加「最大等待時間」而不是無條件等滿。

## 正確性條件

1. 所有對 `head`、`tail`、`count`、`closed` 的讀寫都在 Mutex 保護下。
2. 等待使用 `while (條件不成立)`；Queue 關閉時，所有等待者都能醒來。
3. Consumer 在關閉後要能繼續取完 Queue 內剩餘資料，最後才退出。
4. 避免持鎖做 I/O 或大量計算。
5. 不要把 `volatile` 當成取代 Mutex 的同步方法。

## 怎麼驗證

先確認每筆輸入都被處理恰好一次，順序符合要求，Queue 不會超過容量，再用固定 Producer 速率對照修改前後 CPU、平均等待時間、p95 延遲、吞吐量。測試空 Queue、滿 Queue、Producer 提早結束、Consumer 比 Producer 慢，以及正常停止的情況。

若最重要的是「即時收到最新狀態」，不能只拿吞吐量評斷好壞；過長的 Queue 反而可能讓資料越來越舊。

**查證狀態**：POSIX 等待語意參考正式規格；附 C 程式是可獨立建置的示範，不代表已在考場專案或硬體實測效能。

來源：[pthread_cond_wait](https://man7.org/linux/man-pages/man3/pthread_cond_wait.3p.html)、[pthread_mutex_lock](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html)。
