# 實戰導讀 02｜pthread 正確性：從「少算」到「全部處理完」

> 這篇請把 Queue 畫在紙上跟著追。站內的 `examples/pthread_bounded_queue.c` 可作為有界 Queue 練習；範例與 Demo 題目不一定是完全相同的程式。

## 為什麼兩條 Thread 各加 20,000 次，不一定是 40,000？

先假設 `counter=10`，A 和 B 都要做 `counter++`。這行看起來只有一行，卻可能包含：讀取 10 → 計算 11 → 寫回 11。A、B 若都在寫回前讀到 10，最後可能只增加 1。這叫 *lost update*，不是 CPU 不夠快，而是多個 Thread 對同一份資料缺少正確同步。

要修的不是 `printf` 的位置，也不是把計算變慢。有三條常見路：

- 用 Mutex 把「讀－改－寫」整組放進臨界區；適合需要一起維護多個欄位。
- 單純 Counter 可以使用 C11 Atomic，但若邏輯還要求多個欄位保持一致，分開兩個 Atomic 不會神奇地成為同一個交易。
- 每條 Thread 自己計數，等 `join` 後才合併；對互相獨立的工作，常能減少鎖競爭。

## Condition Variable 為何總要回頭看條件

把 Queue 想成共用的裝工作箱，箱子有 7 格。Producer 想放工作，箱子滿了要等；Consumer 想拿工作，箱子空了要等。**Condition Variable 只負責提醒有人可能改過狀態**，不是替 Consumer 保留某一筆工作。

情境：Producer 放入一個 Job，A 被叫醒，但 B 先拿到 Mutex 並取走 Job。A 之後終於取得 Mutex，箱子可能又空了。若用 `if` 等一次就直接 `pop`，A 會讀空；改成 `while` 檢查 predicate，就會發現仍需要等待。

兩種等待都要用相同的 Mutex 保護 Queue 狀態：

```c
/* 這是片段，並非可單獨編譯的完整 C 程式 */
pthread_mutex_lock(&q.mu);
while (q.count == 0 && !q.closed)
    pthread_cond_wait(&q.not_empty, &q.mu);
if (q.count == 0 && q.closed) {
    pthread_mutex_unlock(&q.mu);
    return NULL;
}
/* 現在才可以在鎖內 pop */
```

## 怎麼停止，才不會漏工作

這裡 `closed` 的語意是：**不再接受新工作，但已經放入 Queue 的要全部處理完**。因此正確順序是先等 Producer 全部 `join`，再在 Mutex 內設 closed 並 `broadcast`，Consumer 繼續從非空 Queue pop，直到 `closed && empty` 才退出。反過來若在 Producer 還會放新工作時就 close，就可能讓最後幾筆沒入列。

注意：這種 drain-and-stop 是本篇採用的合約；有些程式要求「立即取消」，規則不同，不能兩套程式混用。

## 程式測試到底確認了什麼

完整範例用 3 個 Producer、4 個 Consumer、容量 7 的環形 Queue，共產生 6,000 個獨立 Job ID。除了檢查 Queue 最後變空，也用 C11 Atomic 記錄**每個 ID 是否恰好被處理一次**。單看加總可能讓重複處理和漏處理互相抵銷，這份測試不允許這種假成功。

你可以自己修改成 CAP=1、CAP=3 或增加 Consumer，再反覆跑。測試通過會增加信心，但仍無法窮盡所有 Thread 排程；必要時另用 TSan 或程式同步分析。

**三個自問：** 為什麼 `signal` 一次不表示某個 Consumer 一定拿到工作？`close` 為什麼要在全部 Producer 結束後？為什麼只檢查總和不夠？

**相關詞條：** Thread、Mutex、Atomic、Condition Variable、Predicate、Spurious Wakeup、Data Race、Join、Deadlock、Ring Buffer、Backpressure、Queue Shutdown。

官方參考：<https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_wait.html>。
