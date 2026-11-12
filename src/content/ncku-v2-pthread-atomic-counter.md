---
id: ncku-v2-pthread-atomic-counter
title: Atomic Counter 與 Mutex 的使用界線
category: pthread
tags: atomic, relaxed, counter, memory_order, 互斥鎖
aliases: atomic,relaxed,counter,memory_order,互斥鎖
source_type: personal
source_url: https://en.cppreference.com/w/cpp/atomic/atomic
verified: false
updated_at: 2026-11-12
summary: 共享計數器搶同一把鎖，先判斷是不是可以使用原子操作。
related: 
priority: P0
difficulty: intermediate
---

# Atomic Counter 與 Mutex 的使用界線

## 遇到什麼情況要查這篇

共享計數器搶同一把鎖，先判斷是不是可以使用原子操作。

## 先理解瓶頸

單一數字的累加可由 atomic fetch_add 完成；但「檢查 A 再改 B」不是只把 A 宣告 atomic 就能安全。Atomic 讓單次讀寫有定義，記憶體順序與跨變數條件還要另看。

## 具體修改／排查示例

```c
#include <stdatomic.h>
atomic_ulong total = 0;
// 每個 Thread 內：
atomic_fetch_add_explicit(&total, 1UL, memory_order_relaxed);
// 此處只用來統計，不拿來通知其他共享資料已準備好
```

## 可以嘗試的方案

### 1. 只用 Atomic 保護單一計數器

**做法**：減少取鎖／放鎖成本。

**先檢查**：更新可用 atomic 定義。

**可能的代價**：高競爭仍可能慢。

**要保留**：每次增量不遺失。

### 2. 每 Thread 局部加總後合併

**做法**：降低共享更新頻率。

**先檢查**：允許最後合併或定期合併。

**可能的代價**：即時統計可能落後。

**要保留**：總和一致。

### 3. 保留 Mutex 保護跨欄位不變條件

**做法**：多欄位必須一併更新時不亂換。

**先檢查**：狀態一致性比速度更重要。

**可能的代價**：鎖競爭成本存在。

**要保留**：整組狀態一致。

## 具體驗證流程

用相同數量工作者、相同增量次數對照 mutex 和 atomic；每次必須得到 N * ROUNDS。再量 CPU 和吞吐，特別測高競爭情況。

## 什麼情況不該用

memory_order_relaxed 只適合不要求透過計數器同步其他資料的案例。非原子共享讀寫有 data race，屬於錯誤而非只是偶爾少一筆。

## 參考與查證狀態

- 參考：[C++ atomics](https://en.cppreference.com/w/cpp/atomic/atomic)
