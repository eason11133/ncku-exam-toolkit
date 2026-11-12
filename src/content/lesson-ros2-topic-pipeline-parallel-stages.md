---
id: lesson-ros2-topic-pipeline-parallel-stages
title: 確認是否適合拆成處理階段
category: ROS 2
tags: ros2 topic, ROS 2 Topic／Publisher／Subscriber, 效能優化
aliases: parallel-stages, ros2-topic-pipeline
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html
verified: false
updated_at: 2026-11-12
summary: 若處理可彼此獨立，評估分階段與非同步處理。
related: ncku-ros2-cli-workflow
---

# 確認是否適合拆成處理階段

## 先弄懂這個問題

目前的方法是 **ROS 2 Topic／Publisher／Subscriber**。訊息從 Publisher 經 Topic 到 Subscriber，Callback 處理後可能再發布；先定位收不到資料的那一段。

這個方案的目的是：把 I/O 等待與計算隔離，可能降低互相阻塞；但需要額外的佇列和完成順序設計。

你可以先想像這個情境：感測器收到訊息後，要做耗時分析與發送。

## 修改前：先看哪裡有問題

```python
def callback(self, msg):
    heavy_compute(msg)   # 同步阻塞 executor
```

## 修改後：對照實作

```python
# 示意架構：callback 快速交給有上限的工作佇列
from queue import Queue, Full
work = Queue(maxsize=32)

def callback(self, msg):
    try:
        work.put_nowait(copy_needed_fields(msg))
    except Full:
        record_drop(msg)  # 只適用於允許丟棄的資料；否則必須改背壓策略
# 另一 worker 消費 work，重計算後安全回傳結果
```

## 逐步理解，為什麼這樣改

分段後 callback 返回更早，但排隊、資料複製、輸出順序及 worker 與 ROS node 的互動都要另外設計。`put_nowait` 在滿載會丟 `Full` 例外。上方選擇記錄並丟棄，只有任務允許丟失時才成立；若每筆都必須保留，就需讓上游等待或採用其他背壓策略，並量測新增等待。`copy_needed_fields`、`record_drop` 與 worker 是待整合的應用函式，這不是完整 ROS 2 節點。

## 什麼情況才適合

- 各階段可獨立處理
- 可以定義緩衝上限及溢出策略

## 常見錯誤與代價

- 增加佇列記憶體與排程成本
- 順序和丟失策略可能改變

**正確性界線：** 先檢查必要順序、背壓與資料是否會被重複處理。

## 怎麼做測試

固定訊息序號驗證沒有丟失/亂序（若任務要求），測輸入速率升高時的 queue backlog 和總延遲。

優先觀察：端到端延遲、throughput、記憶體、正確性。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


Topic 正常收到資料，但 Subscriber Callback 同步處理太久、後續工作彼此獨立時，才評估有上限 Queue 與非同步階段，並處理 Queue Full、完成順序及關閉。

## 參考文件與驗證狀態

- [ROS 2 Jazzy Executors](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html)
- [ROS 2 Jazzy Callback Groups](https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html)
