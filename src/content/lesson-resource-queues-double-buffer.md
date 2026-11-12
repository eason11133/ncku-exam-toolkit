---
id: lesson-resource-queues-double-buffer
title: 雙緩衝區交換讀寫角色
category: Concurrency
tags: double buffer, Queue／Double Buffer／Backpressure, 效能優化
aliases: double-buffer, resource-queues
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/memory_model.html
verified: false
updated_at: 2026-11-12
summary: Producer 寫一塊、Consumer 讀另一塊，符合條件時減少互相等待。
related: ncku-systems-foundations
---

# 雙緩衝區交換讀寫角色

## 先弄懂這個問題

目前的方法是 **Queue／Double Buffer／Backpressure**。Producer 和 Consumer 速率不同時需要緩衝及背壓策略，否則延遲或記憶體可能越積越多。

這個方案的目的是：讀寫分離並在明確同步點交換緩衝區。

你可以先想像這個情境：Producer 正在寫資料時，Consumer 又要讀，兩者互相搶鎖。

## 修改前：先看哪裡有問題

```text
# 概念：同一 buffer 被讀寫兩側重複持鎖
lock(); shared.append(new_value); unlock()
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```text
# 示意流程（非可執行 API）
producer_write(write_buf)
lock()
read_buf, write_buf = write_buf, read_buf
unlock()
consumer_process(read_buf)  # 離開鎖後處理；須確保不會被覆寫
```

## 逐步理解，為什麼這樣改

交換兩塊 buffer 的角色，讓昂貴處理離開臨界區。最關鍵的是所有權：Consumer 還在使用的 buffer，Producer 不能重新拿去寫。兩塊不足時需要等待、回壓或更多 buffer。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 消費者不會仍在讀舊 buffer
- 交換順序與記憶體同步安全

## 常見錯誤與代價

- 占兩份 buffer 記憶體
- 若處理速率不均仍需更深 queue

**正確性界線：**不可在 Consumer 讀取時覆寫緩衝區，需確認釋放條件。

## 怎麼做測試

模擬慢 Consumer，檢查沒有讀到半寫資料或被覆寫；比較鎖持有時間與等待延遲。

優先觀察：throughput、waiting、RSS。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **queue backlog** 或 **生產速度高於消費速度** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [C memory model](https://en.cppreference.com/w/c/language/memory_model.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
