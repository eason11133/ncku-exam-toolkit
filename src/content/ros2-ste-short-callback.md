---
id: ros2-ste-short-callback
title: SingleThreadedExecutor：先縮短 Callback
category: ROS 2
tags: ROS 2,SingleThreadedExecutor,Callback,效能優化,Python
aliases: short callback,callback duration,快取
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html
verified: false
updated_at: 2026-11-12
summary: 確認 Callback 真正做了什麼，把不必要的工作移走，通常比立即改多執行緒更容易判斷。
related: ros2-ste-multithreaded-groups,ros2-ste-process-pool
priority: P0
difficulty: intermediate
---

# 先縮短 Callback：為什麼這招可能有效？

## 30 秒判斷

ROS 2 的 Callback 可以先把它當成 Python 的「事件發生時自動呼叫的函式」。收到訊息就呼叫一次，計時器到了也會呼叫一次。

如果程式使用 `SingleThreadedExecutor`，同一時間只跑一個 Callback。假設 A 花 0.4 秒處理訊息，B 剛好在 A 開始後 0.1 秒就準備好，B 也必須等 A 結束才能開始。**這裡的問題是 B「還沒開始」就先花了時間等待**。

所以第一個可以檢查的方向是：**A 的 0.4 秒真的每次都必要嗎？** 如果其中 0.2 秒是在重複計算不變的設定，移走那一段，就能讓 A 早點返回。但如果 A 確實要處理每筆輸入，任意省掉計算可能直接把答案算錯。

要先檢查：

- A 是等待網路、檔案，還是在做運算？
- B 的延遲主要發生在開始前，還是 B 自己執行太久？
- A 裡有沒有每次做都得到相同結果的工作？結果真的不會隨訊息或時間改變嗎？

## 實際例子：設定每次都被重複解析

假設你的 Node 每收到一筆資料都要根據相同的 JSON 設定判斷閾值：

```python
import json

# 原本：每次收到訊息都解析一遍固定設定
def on_message(self, msg):
    config = json.loads(self.config_json)
    limit = config["limit"]
    self.handle(msg, limit)
```

如果 `self.config_json` 從程式開始到結束都不變，可以把解析放到建立 Node 的時候：

```python
# 在 __init__ 先解析一次
self.config = json.loads(self.config_json)

# 每筆訊息只取出已解析的設定
def on_message(self, msg):
    limit = self.config["limit"]
    self.handle(msg, limit)
```

`json.loads` 不是消失了，而是從「每筆訊息執行一次」變成「初始化執行一次」。你本來熟悉的 Python `dict` 沒變，改的是它被建立的時間。**這是示範搬移工作的方法，不保證 `json.loads` 一定是考場專案的瓶頸。**

如果設定可能在運作中更新，以上做法就不能直接用。必須在設定改變時重新解析，並保證新的 Callback 不會一直讀舊值。這就是「快取」有成本的原因，不是只加一行 `self.config` 就一定正確。

## 真正修改專案時的順序

1. 找到 `rclpy.spin(...)` 和耗時 Callback 的函式名稱。
2. 用 `time.perf_counter()` 在 Callback 入口與出口各記一次時間，計算本次執行時間。例如：

   ```python
   start = time.perf_counter()
   try:
       # 原有 Callback 的處理內容
       ...
   finally:
       elapsed_ms = (time.perf_counter() - start) * 1000
       self.get_logger().info(f"callback took {elapsed_ms:.1f} ms")
   ```

3. 看最耗時的程式段落：是重複讀設定、重複建立大物件、等待網路、還是做必要的逐筆運算？不要看到 Callback 慢就直接改成多執行緒。
4. 只移動**可證明不依賴每筆訊息**的工作。不能將需要每次計算的值硬快取。若有更新事件，就設計快取失效。
5. 比對修改前後的輸出，確定結果、數量、順序和更新時機都沒變。

## 怎麼測才知道有沒有幫助？

先固定一組可重放的輸入或測試訊息，用相同的硬體、相同的訊息速率，至少記錄：

- 每次 A 的開始、結束時間，算出 A 的執行時間。
- B 的預期觸發時間與實際開始時間（若要精確計算等待，需用可追蹤的事件時間戳，而不只看 log 出現的時刻）。
- 端到端延遲、CPU、記憶體。若速度指標不變但輸出錯了，這次修改不能算成功。

**怎麼判斷？** 如果 A 的耗時穩定下降、B 開始執行的等待也下降，而且正確性測試全過，這個方案在目前負載下才算有改善的證據。如果 A 幾乎沒有變短，或 B 還是在等其他事，就回去查其他瓶頸。

## 什麼情況下別直接套？

如果每個訊息的資料都不同，需要計算的結果也不同，就不能把工作只跑一次。若耗時其實是等待 I/O，可以考慮非同步 I/O 或另一種執行安排；若是大型純 Python 計算，也可能需要分離 Process。但都要先證明瓶頸，不要只因為技術名詞聽起來先進就換掉。

**查證狀態**：原理參考 ROS 2 Jazzy 官方 Executor 文件；程式示例尚未在 ROS 2 Jazzy 執行；無效能實測。

參考：[ROS 2 Jazzy Executors](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html)。
