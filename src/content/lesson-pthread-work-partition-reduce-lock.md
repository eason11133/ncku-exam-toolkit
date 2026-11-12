---
id: lesson-pthread-work-partition-reduce-lock
title: 減少頻繁全域鎖
category: Concurrency
tags: pthread create, pthread 分工／工作分片, 效能優化
aliases: reduce-lock, pthread-work-partition
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html
verified: false
updated_at: 2026-11-12
summary: 若資料可分片，考慮局部緩衝或較低頻合併。
related: ncku-pthread-critical-section
---

# 減少頻繁全域鎖

## 先弄懂這個問題

目前的方法是 **pthread 分工／工作分片**。多執行緒可以處理獨立工作；但共享資料、工作分配與記憶體存取會決定效益。

這個方案的目的是：減少所有 worker 同時等待單一鎖。

你可以先想像這個情境：每處理一筆就 lock/unlock 共享總和。

## 修改前：先看哪裡有問題

```c
for (size_t i = begin; i < end; ++i) {
    pthread_mutex_lock(&m);
    total += a[i];
    pthread_mutex_unlock(&m);
}
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```c
long local = 0;
for (size_t i = begin; i < end; ++i) local += a[i];
pthread_mutex_lock(&m);
total += local;
pthread_mutex_unlock(&m);
```

## 逐步理解，為什麼這樣改

局部累加讓每條 thread 只需要一次鎖，通常比每個元素都搶更有機會擴展。前提是這種合併不會改變題目要求的即時可見性。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 分片可定義
- 跨分片一致性有策略

## 常見錯誤與代價

- 複雜度與記憶體增加
- 跨分片更新仍可能需要同步

**正確性界線：**不能因為減鎖就丟掉共享更新。

## 怎麼做測試

確認總和一致並比對 mutex wait time；測競爭較低時是否反而不划算。

優先觀察：鎖等待、RSS、正確性。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **threads slower** 或 **工作量不均** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [POSIX pthread_mutex_lock](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
