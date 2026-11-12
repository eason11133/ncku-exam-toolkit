---
id: lesson-resource-queues-bounded-queue
title: 設定有上限的 Queue
category: Concurrency
tags: double buffer, Queue／Double Buffer／Backpressure, 效能優化
aliases: bounded-queue, resource-queues
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-12
summary: 避免無界排隊吃光記憶體，但要明確選擇滿了怎麼辦。
related: ncku-systems-foundations
---

# 設定有上限的 Queue

## 先弄懂這個問題

目前的方法是 **Queue／Double Buffer／Backpressure**。Producer 和 Consumer 速率不同時需要緩衝及背壓策略，否則延遲或記憶體可能越積越多。

這個方案的目的是：限制待處理工作數；滿佇列可阻塞生產者、拒絕新資料或按規格丟舊資料。

你可以先想像這個情境：Producer 每秒送 1,000 筆，Consumer 每秒只能處理 100 筆。

## 修改前：先看哪裡有問題

```python
from queue import Queue
q = Queue()       # 無上限，若持續堆積會耗盡記憶體
```

## 修改後：對照實作

```python
from queue import Queue, Full
q = Queue(maxsize=128)
try:
    q.put(item, timeout=0.02)
except Full:
    handle_overload(item)  # 明訂阻塞、丟棄或回報策略
```

## 逐步理解，為什麼這樣改

有界 Queue 不能讓 Consumer 突然變快；它只讓過載有明確上限和可觀察的失敗行為。`handle_overload` 必須根據題目決定，不能偷偷丟資料。

## 什麼情況才適合

- 可定義丟失／阻塞語意
- 有觀測 queue 長度

## 常見錯誤與代價

- 阻塞會回傳壓力給前段
- 丟資料可能破壞正確性

**正確性界線：** 隊列滿的測試必須檢查訊息數量與順序。

## 怎麼做測試

把輸入速率調高，觀察 Queue 長度、記憶體、遺失數/拒收數及端到端延遲。

優先觀察：queue depth、p95、RSS、loss rate。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **queue backlog** 或 **生產速度高於消費速度** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [ROS 2 Jazzy QoS](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
