---
id: ncku-v2-pthread-timeout-shutdown
title: pthread Condition Variable 逾時與停止流程
category: pthread
tags: condvar, shutdown, broadcast, timedwait, worker
aliases: condvar,shutdown,broadcast,timedwait,worker
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_timedwait.html
verified: false
updated_at: 2026-11-12
summary: 程式正常工作卻結束不了，常見原因是 worker 在 cond_wait 永遠等不到通知。
related: 
priority: P1
difficulty: intermediate
---

# pthread Condition Variable 逾時與停止流程

## 遇到什麼情況要查這篇

程式正常工作卻結束不了，常見原因是 worker 在 cond_wait 永遠等不到通知。

## 先理解瓶頸

典型的 queue 工人會在空佇列時 wait。停止時需要在持鎖下更新 stop flag，再通知全部等待者，讓它們醒來後檢查退出條件。條件等待可能虛假喚醒，所以必須用 while 檢查 predicate。

## 具體修改／排查示例

```c
pthread_mutex_lock(&mu);
stopping = true;
pthread_cond_broadcast(&cv);
pthread_mutex_unlock(&mu);
// worker 內：while (queue_empty && !stopping) pthread_cond_wait(&cv, &mu);
// 外面等所有 worker pthread_join 結束
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 更新停止旗標並 broadcast

**做法**：喚醒所有可能卡住的 worker。

**先檢查**：有共享 predicate 在 Mutex 下保護。

**可能的代價**：需要明確 drain/discard 政策。

**要保留**：所有 Thread 正常離開。

### 2. 改用 while predicate 等待

**做法**：處理虛假喚醒與競爭。

**先檢查**：每次醒來都檢查 queue/stop。

**可能的代價**：需小心解鎖位置。

**要保留**：不讀空 queue。

### 3. 設定可控逾時與取消策略

**做法**：避免異常等待無期限。

**先檢查**：可以處理 timeout 狀態。

**可能的代價**：時間基準易搞錯。

**要保留**：逾時也安全清理。

## 具體驗證流程

測零筆任務就停止、排隊中停止、正常耗盡後停止、連續多次啟停；給每次 join 設外部測試逾時。確認 pending 工作要丟棄或完成的政策。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

pthread_cond_timedwait 的時間基準要和 condattr 設定一致；實際時間可因排程變長。cond_wait 不是事件計數器，不能只靠通知次數判斷工作完成。

## 參考與查證狀態

- 參考：[POSIX pthread_cond_timedwait](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_cond_timedwait.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
