---
id: opt-cond-batch-pop
title: 從 Queue 批次取工作：先解鎖再運算
category: Concurrency
tags: Concurrency, pthread-condition-queue, 考場排查, 實作條件
aliases: opt-cond-batch-pop, 從 Queue 批次取工作：先解鎖再運算
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_wait.html
verified: false
updated_at: 2026-11-13
summary: 將短工作批次出隊，減少拿鎖次數；仍要處理完成順序與關閉。
related: ncku-pthread-condvar-queue
---

# 減少每筆 Lock，但不要讓別人在鎖內等你算完

**適用情況**：工作很小、拿鎖次數遠多於真正計算的次數，Producer 和 Consumer 的 Queue 已經正確同步。若真正慢的是外部 I/O 或演算法，批次 pop 不一定有效。

## 原理：在鎖內只「取走」，鎖外才「處理」

```c
/* C/POSIX 片段：q、mu、not_empty、closed、pop_locked 需由原程式定義。 */
Job local[16];
size_t n = 0;
pthread_mutex_lock(&mu);
while (queue_empty(&q) && !closed)
    pthread_cond_wait(&not_empty, &mu);
while (n < 16 && !queue_empty(&q))
    local[n++] = pop_locked(&q);
/* pop 時若釋出容量，還須通知正在等 not_full 的 Producer。 */
pthread_mutex_unlock(&mu);
for (size_t i = 0; i < n; ++i)
    process(local[i]);
/* closed && n==0 時退出；仍有工作時要處理完。 */
```

這段是**整合片段，不可獨立編譯**。`Job` 若持有指標，必須明確決定 payload 的所有權；只複製指標不等於安全轉交。若有多位 Consumer，批次大小會影響公平性；`process()` 產生結果的完成順序可能與 Queue 入隊順序不同。

## 正確驗收

先用序號 0..N-1 進 Queue，記錄出隊、處理、輸出三個事件。若輸出必須依序，設計序號重排或單一輸出者；若只要求每筆一次，驗證每個序號恰好一次。測 N=0、N<16、17、1000 及關閉時留下的最後一批。用「相同工作總量」比較總耗時、p95 與鎖等待，而不是只比每次 pop 的時間。

**不要誤用**：不可在 mutex 持有期間執行 `process()` 或寫大量 Log，也不能因 Batch 比較快就無條件增加排隊延遲；若工作有截止期限，需加最大等待時間。
## 先別看程式，想一個 5 筆工作的 Queue

Queue 裡依序放著 `A B C D E`，每次拿鎖只取一筆，要拿鎖 5 次。若每批最多取 3 筆，第一次在鎖內取出 `A B C`，然後**先解鎖**，才處理 A、B、C；第二次取 D、E。正確性要求是 A～E 都被取到且各一次，不是拿鎖次數變少就算成功。

### 多個 Consumer 時，輸出順序可能改變

Consumer 1 先取走 A/B/C，但 A 計算很慢；Consumer 2 後取走 D/E，卻先算完。這時**取出順序**仍是 A、B、C、D、E，**完成順序**可能變成 D、E、B、C、A。若題目要求輸出依序，就需要序號重排；如果只要求每筆正確完成，順序限制才可能不同。

### `closed` 與 Queue 空了，也要一起看

Worker 等待時應在 mutex 保護下判斷「Queue 空，而且尚未關閉」；被 `pthread_cond_wait` 喚醒後用 `while` 重新檢查。`closed=true` 不代表 Queue 立刻被清空：如果要求處理完剩餘工作，Worker 應先把 Queue 裡的資料取走，**空而且 closed** 時才退出。

比方說停止訊號到來時 Queue 還有 E，如果程式看到 closed 就直接 `return`，E 會遺失。這是邏輯錯誤，跟是否死鎖無關。

### 為什麼要有兩種 Condition Variable？

有界 Queue 可能同時有等資料的 Consumer 和等空位的 Producer。Consumer 取走資料後通常要通知 `not_full`；Producer 放入資料後通常要通知 `not_empty`。只通知其中一端，就可能讓另一邊一直睡著，雖然 Queue 狀態已經可以往前走。

**最小驗收：** 先測 0、1、3、4、5 筆；再在 Queue 滿時讓 Producer 等候，關閉前留下最後一批；確認每筆 ID 恰好一次，程式可以退出，且沒有睡著的 Thread 永遠等不到通知。
