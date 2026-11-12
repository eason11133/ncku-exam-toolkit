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

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```c
// 概念：每個 worker 做 [begin,end) 不重疊分片
for (size_t i = begin; i < end; ++i) local += square(a[i]);
// join 後，main 將每個 worker 的 local 合併
```

## 逐步理解，為什麼這樣改

分片通常採 `[begin,end)`，可以涵蓋尾端不足一塊的元素並避免重疊。若浮點數合併順序不同，結果可能微小差異；整數累加也需檢查溢位。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 不需要每步共享全局狀態
- 分塊與合併邊界正確

## 常見錯誤與代價

- 工作不均造成慢執行緒拖住整體
- 額外同步與分工成本

**正確性界線：**驗證切分後每筆資料恰好處理一次，輸出順序符合規格。

## 怎麼做測試

驗證所有 index 只處理一次、n 小於 thread 數也正確；比較 1/2/4/8 workers。

優先觀察：總耗時、CPU、輸出正確性。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **threads slower** 或 **工作量不均** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [C memory model](https://en.cppreference.com/w/c/language/memory_model.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
