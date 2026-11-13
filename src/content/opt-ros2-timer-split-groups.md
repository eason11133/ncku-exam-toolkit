---
id: opt-ros2-timer-split-groups
title: Timer 與 Subscription 是否能分組並行？
category: ROS 2
tags: ROS 2, ros2-timer-jitter, 考場排查, 實作條件
aliases: opt-ros2-timer-split-groups, Timer 與 Subscription 是否能分組並行？
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html
verified: false
updated_at: 2026-11-13
summary: MultiThreadedExecutor 需要合適 Callback Group，否則預設互斥群組仍會序列執行。
related: ncku-ros2-executor
---

# 換成 MultiThreadedExecutor，Timer 仍然慢？

ROS 2 的預設 Callback Group 是互斥群組。即使 Executor 有 2 條 Worker Thread，Timer 和 Subscription 都放在同一個預設群組時仍不能同時執行。真正需要重疊時，才把獨立工作放到不同的群組，並確保共享資料安全。

## rclpy 節點內的整合片段

```python
from rclpy.callback_groups import MutuallyExclusiveCallbackGroup
from rclpy.executors import MultiThreadedExecutor

# Node.__init__ 內：保存兩個 Group 與 Timer 的參照
self.timer_group = MutuallyExclusiveCallbackGroup()
self.sub_group = MutuallyExclusiveCallbackGroup()
self.timer = self.create_timer(0.1, self.timer_cb,
                               callback_group=self.timer_group)
self.sub = self.create_subscription(MyMsg, '/input', self.sub_cb, 10,
                                    callback_group=self.sub_group)
# main() 內：executor = MultiThreadedExecutor(num_threads=2)
# executor.add_node(node); executor.spin()
```

`MyMsg`、`timer_cb` 和 `sub_cb` 需由原專案提供；上面不是可直接執行的整支 Node。不同 group **允許**重疊，不保證一定重疊。若兩個 callback 同時改同一個 Python list 或狀態，也要設計同步與順序。一般 CPython 的 GIL 仍限制純 Python CPU-bound 工作的多核心效果，不能把 Executor 換掉就宣稱 CPU 計算倍速。

## 如何判斷是否值得換

先記錄 Timer 與 Subscription 的開始／結束時間，確認長時間互相等待；再量同樣輸入下的 callback 重疊區段。若瓶頸是單一純 Python 演算法，考慮先改演算法或 Process Pool。若是同步 Service 等待造成死鎖，應先改 async，不能只靠增加執行緒碰運氣。

**驗收**：同負載對照 SingleThreaded、MultiThreaded 不同 Group；比對訊息完整性與必要順序，特別測同時進入更新共享資料的情況。本片段未在 ROS 2 Jazzy 實際執行。

---

## 深讀：同一個程式有兩條執行緒，為什麼兩個 Callback 還是一個一個跑？

把 Executor 想成有兩位工作者；Callback Group 是「哪些工作同一時間可以領走」的規則。如果 Timer 和 Subscription 都在同一個 `MutuallyExclusiveCallbackGroup`，即使 Executor 有兩位工作者，也只會讓其中一位先做。同一組內的另一個 Callback 得等它離開群組。

| 時間（純示意） | Timer | Subscription | 情況 |
|---|---|---|---|
| 0 ms | 開始處理，耗時 80 ms | 訊息到達 | 同一互斥 Group |
| 10 ms | 還在忙 | 仍在等 | 第二條 Worker 也不能違反 Group 的互斥規則 |
| 80 ms | 返回 | 才可能開始 | 延遲不等於網路一定慢 |

你需要先量**Callback 的開始與結束時間**，再判斷是不是同 Group 的排程限制；不要先把參數改成四個 Thread 就宣稱優化成功。

**什麼時候能拆 Group？** Timer 與 Subscription 必須能安全重疊；如果兩個都在寫同一個容器、更新同一個機器人狀態，還要先討論保護方式。不同 Group 只代表允許並行，不保證一定同時執行，也不會自動克服一般 CPython 執行環境下純 Python CPU 計算的 GIL 限制。

**你在考場可以照這個順序查：** 節點是否真的在 spin → callback 是否有被呼叫 → callback 耗時在哪段 → executor thread 數 → group 身分 → 共享資料與輸出順序。只有在證實互斥排程是瓶頸時，才考慮重分組。

**小題目：** Timer 每 100 ms 觸發，但每次計算 150 ms。多開 Worker 能讓每筆任務都在 100 ms 內完成嗎？不行。即使允許重疊，任務處理量和排隊負載仍要評估；若計算本身是瓶頸，先考慮演算法或降頻是否符合題目需求。
