---
id: opt-pthread-wait-loop
title: 等待 Predicate 與停止條件：醒來再檢查
category: Concurrency
tags: Concurrency, pthread-timeout-shutdown, 考場排查, 實作條件
aliases: opt-pthread-wait-loop, 等待 Predicate 與停止條件：醒來再檢查
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_wait.html
verified: false
updated_at: 2026-11-13
summary: 避免虛假喚醒、另一 Consumer 先取走工作與停止時讀空 Queue。
related: ncku-v2-pthread-timeout-shutdown
---

# `signal` 只是提醒，不是把 Queue 的一筆資料交到手上

**什麼情況查**：程式偶爾在空 Queue 做 pop、增加 Thread 後才出現錯誤，或關閉時讀到未初始化值。原因可能是 Consumer 以 `if (empty)` 等待一次，醒來後就直接取資料。

## 正確的控制流程

```c
/* 可嵌入原程式的 C/POSIX 片段，不含 Queue 型別與初始化。 */
pthread_mutex_lock(&q.mu);
while (q.count == 0 && !q.stopping)
    pthread_cond_wait(&q.not_empty, &q.mu);
if (q.count == 0 && q.stopping) {
    pthread_mutex_unlock(&q.mu);
    return NULL;                  /* Worker 函式已到結束條件 */
}
Job job = queue_pop_locked(&q);  /* 必須仍持 mutex */
pthread_cond_signal(&q.not_full);
pthread_mutex_unlock(&q.mu);
process(job);                    /* 若可獨立處理，移到鎖外 */
```

這段無法獨立編譯；`Job`、`queue_pop_locked`、`process` 需接到現有 Queue。不能把 `q.stopping` 在別的地方不加鎖隨意寫入。Condition Variable 不會替你保護 `head/tail/count`，只有 mutex 及一致的存取規則能做到。

## 為什麼需要 `while`

Condition Variable 允許虛假喚醒；兩個 Consumer 也可能都被通知，但只有一個取得資料。重新拿到 mutex 時，`q.count` 可能變回零。因此醒來重新檢查條件是必要動作。這也是停止流程為何必須把 `!stopping` 納入等待 predicate。

**驗收**：讓 2 個 Consumer 搶 1 個 job、N=0 直接停、N=1 停止、滿 Queue 時 Producer 等待、通知與解鎖先後不同。每個 job 必須只被處理一次；若 `stopping` 的語意要求 drain，應排空後才退出。不要因為一次測試沒重現競爭就視為安全。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：為什麼 `if` 會把你害慘

排隊區只有一筆工作 `J7`，有 Consumer A、B。A 先睡在條件變數；Producer 放入 `J7` 並通知。A **被喚醒不等於立刻拿到 Mutex**。在 A 拿回鎖以前，B 可能先取得 Mutex、取走 `J7` 並解鎖。這時 A 終於取得鎖，若前面只寫 `if (count==0) wait()`，A 會直接執行 `pop`，但 Queue 已經空了。

改成 `while(count==0 && !stopping) wait()`：A 取得鎖之後重新看 `count`，發現又是零，就繼續等。不用等到真正發生虛假喚醒才會出錯，**正常的排程交錯**就可能讓 `if` 失效。

停止流程還有另一個陷阱。假設 Producer 全部結束，你設 `stopping=true` 但忘了 `broadcast`，有些 Consumer 可能永遠睡著；反過來，若先 `broadcast` 才設 `stopping` 且未依相同 Mutex 規則同步，醒來的執行緒仍可能看到舊狀態、又睡回去。正確模式是在 Mutex 內更新 Queue 狀態，讓醒來者重查 predicate。

| 重新拿到鎖時 | Consumer 的動作 |
|---|---|
| `count>0` | 取一筆，必要時通知等待空位的 Producer |
| `count==0 && !stopping` | 繼續等 |
| `count==0 && stopping` | 正常結束 |

**練習：** 把一次 `signal` 換成 `broadcast` 是否仍正確？只要用 `while` 重查狀態，就不會因為多個 Consumer 都醒來而重複取同一筆。是否效率合適另行評估。
