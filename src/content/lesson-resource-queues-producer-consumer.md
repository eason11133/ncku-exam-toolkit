---
id: lesson-resource-queues-producer-consumer
title: 減少高頻跨執行緒共享
category: Concurrency
tags: double buffer, Queue／Double Buffer／Backpressure, 效能優化
aliases: producer-consumer, resource-queues
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/memory_model.html
verified: false
updated_at: 2026-11-12
summary: 使用明確的單向資料通道避免多處直接改共享狀態。
related: ncku-systems-foundations
---

# 減少高頻跨執行緒共享

## 先弄懂這個問題

目前的方法是 **Queue／Double Buffer／Backpressure**。Producer 和 Consumer 速率不同時需要緩衝及背壓策略，否則延遲或記憶體可能越積越多。

這個方案的目的是：讓資料所有權在 Producer / Consumer 之間交接，減少共同修改。

你可以先想像這個情境：Producer 和 Consumer 每處理一個數字就更新全域統計與 Log。

## 修改前：先看哪裡有問題

```python
for item in items:
    with lock:
        global_count += 1
        output.append(process(item))
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```python
local_output = [process(item) for item in items]
with lock:
    global_count += len(items)
    output.extend(local_output)
```

## 逐步理解，為什麼這樣改

把單筆粒度改成區塊粒度可以減少互斥次數，但 `process` 必須可在鎖外安全執行。若要求嚴格的跨 Producer 全域順序，必須另外標序號。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 有可明確分界的資料流
- 可設計 shutdown 和 backpressure

## 常見錯誤與代價

- 需要額外排程
- 若 queue 無界會爆記憶體

**正確性界線：**比對無損、無重複、必要先後順序。

## 怎麼做測試

用多個 Producer 混合負載，檢查筆數、順序要求與共享資料競爭；測鎖時間和吞吐。

優先觀察：latency、CPU、RSS。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **queue backlog** 或 **生產速度高於消費速度** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [C memory model](https://en.cppreference.com/w/c/language/memory_model.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
