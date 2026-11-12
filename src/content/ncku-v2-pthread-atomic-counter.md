---
id: ncku-v2-pthread-atomic-counter
title: Atomic Counter 與 Mutex 的使用界線
category: pthread
tags: atomic, relaxed, counter, memory_order, 互斥鎖
aliases: atomic,relaxed,counter,memory_order,互斥鎖
source_type: personal
source_url: https://en.cppreference.com/w/c/atomic/atomic_fetch_add
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

單一計數器的累加可用 C11 `<stdatomic.h>` 的 `atomic_fetch_add_explicit()`：各執行緒對同一個 atomic 物件做讀取、修改、寫回，不會互相覆蓋增量。`memory_order_relaxed` 保證此計數器操作本身的原子性，**不**建立其他非原子資料的先後可見性。若程式要「先檢查 A，再一起更新 A、B」，只把 A 改成 atomic 無法保護整組不變條件，仍需鎖或經過證明的原子協定。

## 具體修改／排查示例

以下是 **pthread 工作函式片段**；呼叫端仍須建立與 join 每個執行緒，且在啟動前初始化 `total`。所有執行緒都結束後，主執行緒才能把最後讀值當作完整統計。

```c
#include <stdatomic.h>
#include <stddef.h>

static atomic_ulong total = ATOMIC_VAR_INIT(0);

void *count_one(void *unused) {
    (void)unused;
    atomic_fetch_add_explicit(&total, 1UL, memory_order_relaxed);
    return NULL;
}

/* pthread_create(..., count_one, ...); pthread_join(...); 後再讀 total。 */
```

這個範例只統計次數，不用 `total` 宣告別的共享資料已準備好。若其他共享資料依賴計數器作為通知，必須重新設計同步順序。數值也要確保不超過 `unsigned long` 的範圍；高競爭下 atomic 不保證比 mutex 或每執行緒局部加總快。

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

- [C11 `atomic_fetch_add_explicit()`](https://en.cppreference.com/w/c/atomic/atomic_fetch_add)
- [C11 `<stdatomic.h>`](https://en.cppreference.com/w/c/header/stdatomic)
- [WG14 C11 草案 N1570 §7.17：原子操作與記憶體順序](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)
- API 與 relaxed 語意已對照 C 語言參考資料；此 pthread 片段未在目標環境執行。
