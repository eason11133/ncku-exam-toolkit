---
id: lesson-pthread-work-partition-partition-independent
title: 將獨立資料按範圍切分
category: Concurrency
tags: pthread create, pthread 分工／工作分片, 效能優化
aliases: partition-independent, pthread-work-partition
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/memory_model.html
verified: false
updated_at: 2026-11-12
summary: 每個執行緒處理不重疊的資料範圍，最後合併。
related: ncku-pthread-critical-section
---

# 將獨立資料按範圍切分

## 先弄懂這個問題

目前的方法是 **pthread 分工／工作分片**。多執行緒可以處理獨立工作；但共享資料、工作分配與記憶體存取會決定效益。

這個方案的目的是：減少共享寫入；資料需可安全獨立處理。

你可以先想像這個情境：要對 100 萬個數字做彼此獨立的平方和。

## 修改前：先看哪裡有問題

```c
long total = 0;
for (size_t i = 0; i < n; ++i) total += square(a[i]);
```

## 修改後：對照實作

```c
// 概念：每個 worker 做 [begin,end) 不重疊分片
for (size_t i = begin; i < end; ++i) local += square(a[i]);
// join 後，main 將每個 worker 的 local 合併
```

## 逐步理解，為什麼這樣改

分片通常採 `[begin,end)`，可以涵蓋尾端不足一塊的元素並避免重疊。若浮點數合併順序不同，結果可能微小差異；整數累加也需檢查溢位。

## 什麼情況才適合

- 不需要每步共享全局狀態
- 分塊與合併邊界正確

## 常見錯誤與代價

- 工作不均造成慢執行緒拖住整體
- 額外同步與分工成本

**正確性界線：** 驗證切分後每筆資料恰好處理一次，輸出順序符合規格。

## 怎麼做測試

驗證所有 index 只處理一次、n 小於 thread 數也正確；比較 1/2/4/8 workers。

優先觀察：總耗時、CPU、輸出正確性。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


可拆成彼此獨立的資料範圍，且工作量足以抵銷 thread 建立與合併成本時，才把工作分片並行。避免切片重疊、漏資料與合併溢位。

## 參考文件與驗證狀態

- [C memory model](https://en.cppreference.com/w/c/language/memory_model.html)
