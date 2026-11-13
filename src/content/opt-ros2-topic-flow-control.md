---
id: opt-ros2-topic-flow-control
title: Topic 堆積：批次處理與背壓要保留事件語意
category: ROS 2
tags: ROS 2, ros2-topic-backlog, 考場排查, 實作條件
aliases: opt-ros2-topic-flow-control, Topic 堆積：批次處理與背壓要保留事件語意
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-13
summary: 獨立工作可入有界 Queue，但 Full 處理、輸出順序與關閉流程必須先訂好。
related: ncku-v2-ros2-topic-backlog
---

# 將 Callback 改成「只丟進 Queue」，還沒算解決

Callback 很快返回，可以讓 ROS Executor 去處理別的工作，但資料仍在自己的 Queue 裡排隊。若 Consumer 長期跟不上，Queue 仍會塞滿；若 `put_nowait` 例外就直接忽略，正確性可能反而更差。

## 可在普通 Python 執行的滿載示範

```python
from queue import Queue, Full
q = Queue(maxsize=2)
accepted, rejected = [], []
for seq in range(4):
    try:
        q.put_nowait(seq)
        accepted.append(seq)
    except Full:
        rejected.append(seq)
assert accepted == [0, 1]
assert rejected == [2, 3]
assert [q.get_nowait(), q.get_nowait()] == [0, 1]
print("accepted=2 rejected=2")
```

這只展示 `Full` 的明確行為，**不是推薦直接丟棄 ROS 2 訊息**。若事件不可丟，應先設計上游流控、阻塞或能保證保存的處理通道；阻塞 Subscriber Callback 也可能拖延同 Executor 其他工作，需要衡量。

## 怎麼選 Batch

對可獨立的工作，Consumer 可以每次從 Queue 取最多 K 筆後處理，鎖內只做取走資料；若最終輸出必須按序，設序號和重排／單一輸出端。Batch 雖可能增加 throughput，卻也可能提高最舊工作等待時間。若消息有截止時間，加最大等待期限與 shutdown flush。

**驗收**：固定輸入序列與負載，測 Queue 容量 1／8／64，查看 accepted、processed、rejected、尚未完成的每一筆，確認輸出與原規格完全一致。未做 ROS 2 實測；只在標準 Python 環境驗證 Queue 語意。
## 深讀延伸｜把原理放進真實情境
## 加 Queue 之前，先定義資料可不可以丟

假設 Producer 每秒傳 100 筆，Consumer 每秒只能處理 50 筆。若你只是把 callback 改成「收到就放進無上限 Queue」，前幾秒可能看似很快，Queue 卻每秒多 50 筆，越積越長，舊資料越來越晚被處理。這叫**背壓問題**，不是只換一個 Queue 就能解決。

有兩種完全不同的需求：攝影機即時預覽通常希望最新畫面，允許某些舊幀被丟掉；財務交易／控制指令可能要求每筆事件都處理，不能亂丟。你應先訂出能否捨棄、如何記錄丟棄、滿時阻塞多久、停止時怎麼 drain，才能選有界 Queue 的策略。

將 Subscriber callback 縮短到只放資料，也要注意**callback 的資料是否在回傳後仍有效**。如果你只把可被別人修改的物件參照塞進 Queue，背景 Worker 看到的可能不是收到當下的內容。複製有成本，但跳過複製必須先確認物件生命週期和同步規則。

**驗證：** 送入編號 0..99，記下接收、處理和（若允許）丟棄清單。必要資料必須每個 ID 恰好處理一次；允許丟幀的情況也要明確統計，不能只說 CPU 降了 30%。
