---
id: lesson-pthread-work-partition-thread-count
title: 測量合理的執行緒數
category: Concurrency
tags: pthread create, pthread 分工／工作分片, 效能優化
aliases: thread-count, pthread-work-partition
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/memory_model.html
verified: false
updated_at: 2026-11-12
summary: 多執行緒數量超過可用資源可能變慢。
related: ncku-pthread-critical-section
---

# 測量合理的執行緒數

## 先弄懂這個問題

目前的方法是 **pthread 分工／工作分片**。多執行緒可以處理獨立工作；但共享資料、工作分配與記憶體存取會決定效益。

這個方案的目的是：建立線程、排程、cache、記憶體頻寬都會造成成本。

你可以先想像這個情境：資料量只有 100 筆，卻建立 100 條 thread。

## 修改前：先看哪裡有問題

```c
size_t thread_count = item_count; // 每件工作一條 thread
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```c
size_t thread_count = 4; // 示範固定上限，實際要量測
if (thread_count > item_count) thread_count = item_count;
if (thread_count == 0) return;
```

## 逐步理解，為什麼這樣改

thread 建立與 context switch 有成本，超過 CPU 核心數也不一定會快。這段僅示範設上限；實務上要依工作負載、CPU 核心數和同步成本測最佳值。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 先測單執行緒 baseline
- 可觀察可用核心數及真實工作量

## 常見錯誤與代價

- 結果受環境限制
- I/O 和 CPU 任務不宜用同一假設

**正確性界線：**記錄不同 worker 數的效能曲線，保留最正確且穩定的版本。

## 怎麼做測試

測 1、2、4、8、16 threads，在相同輸入下比較總時間、CPU、記憶體和正確性。

優先觀察：時間、CPU、RSS。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **threads slower** 或 **工作量不均** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [C memory model](https://en.cppreference.com/w/c/language/memory_model.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
