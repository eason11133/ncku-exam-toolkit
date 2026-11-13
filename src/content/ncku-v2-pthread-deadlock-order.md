---
id: ncku-v2-pthread-deadlock-order
title: pthread 多把鎖的 Deadlock 與鎖順序
category: pthread
tags: deadlock, lock ordering, mutex, 互鎖
aliases: deadlock,lock ordering,mutex,互鎖
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html
verified: false
updated_at: 2026-11-12
summary: 兩個 Thread 都不動且 CPU 不高，可能是不同順序取得多把鎖。
related: 
priority: P0
difficulty: intermediate
---

# pthread 多把鎖的 Deadlock 與鎖順序

## 遇到什麼情況要查這篇

兩個 Thread 都不動且 CPU 不高，可能是不同順序取得多把鎖。

## 先理解瓶頸

Thread A 先拿 lock1 再等 lock2；Thread B 先拿 lock2 再等 lock1，就可能永遠互等。重點不是鎖多寡，而是所有路徑是否遵守一致順序。

## 具體修改／排查示例

```c
// C/POSIX 示意：所有工作者先 lock1 再 lock2
pthread_mutex_lock(&lock1);
pthread_mutex_lock(&lock2);
/* 同時需要兩項共享狀態的短小操作 */
pthread_mutex_unlock(&lock2);
pthread_mutex_unlock(&lock1);
```

## 可以嘗試的方案

### 1. 統一取得鎖的順序

**做法**：所有路徑遵循相同 lock ordering。

**先檢查**：能列出每把鎖的順序。

**可能的代價**：仍需排查重入／其他等待。

**要保留**：無互等。

### 2. 減少跨多把鎖的操作

**做法**：降低循環等待依賴。

**先檢查**：能重組共享資料。

**可能的代價**：可能增加狀態不一致風險。

**要保留**：原子性仍正確。

### 3. trylock + 明確失敗策略

**做法**：避免無期限阻塞。

**先檢查**：失敗可重新排程。

**可能的代價**：忙等或飢餓風險。

**要保留**：不丟失必要工作。

## 具體驗證流程

用隨機延遲與大量反覆執行嘗試重現；對所有取得鎖的位置建立先後表，確認沒有例外順序。另測 thread 退出時是否仍持鎖。

## 什麼情況不該用

trylock 不能自動消除所有 deadlock；只是提供一條不阻塞的失敗路徑。錯誤重試也可能造成活鎖。

## 參考與查證狀態

- 參考：[POSIX pthread_mutex_lock](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html)
