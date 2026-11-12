---
id: ncku-ros2-executor
title: ROS 2 Executor 與 Callback：為什麼 A 會卡住 B
category: ROS 2
tags: SingleThreadedExecutor, MultiThreadedExecutor, callback group, GIL, latency
aliases: Executor, 回呼函式, Callback 卡住, timer 延遲
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html
verified: false
updated_at: 2026-11-12
summary: 認出 Callback 等待瓶頸，理解縮短工作、分開 Callback Group、多進程的適用條件。
related: ncku-ros2-cli-workflow, ncku-performance-benchmark
---
# Executor、Callback 與排隊延遲

![簡潔的 SingleThreadedExecutor 時序圖](/diagrams/single-threaded-executor.svg)

**Callback** 是收到訊息、計時器到期、服務請求等事件後執行的函式。**Executor** 選擇哪些 Callback 執行。`SingleThreadedExecutor` 在單一執行緒中執行 Callback，因此 A 執行 300ms，B 在 50ms 就準備好時，B 不能在 A 結束前開始。

注意區分：B「準備好」不是 B「正在執行」；`time.sleep(0.3)` 是示意 I/O 等待，不代表所有 Callback 都在做 sleep。

## 方案 1：先縮短 Callback

```python
from time import perf_counter

def callback(self, msg):
    t0 = perf_counter()
    data = self.parse_data(msg)
    t1 = perf_counter()
    result = self.calculate(data)
    t2 = perf_counter()
    self.publisher.publish(result)
    t3 = perf_counter()
    self.get_logger().info(
        f'parse={(t1-t0)*1000:.2f}ms, '
        f'calc={(t2-t1)*1000:.2f}ms, '
        f'publish={(t3-t2)*1000:.2f}ms'
    )
```

如果計算本身可以減少，例如只求最大值卻先排序全部：

```python
# 修改前：O(n log n) 最壞時間，額外 O(n)
result = sorted(data)[-1]
# 修改後：O(n) 時間，額外 O(1)（data 必須非空）
result = max(data)
```

改動後必須檢查空陣列、資料型別與輸出一致性。把耗時工作搬去**同一個 Executor 的另一個 Callback** 並不自動解決阻塞。

## 方案 2：MultiThreadedExecutor + 分開 Callback Group

`MultiThreadedExecutor` 能安排多個工作執行緒，但預設的 **Mutually Exclusive Callback Group** 不允許同群組 Callback 同時執行。如果 A、B 都留在同一個預設群組，只換 Executor 可能完全無效。

```python
from rclpy.callback_groups import MutuallyExclusiveCallbackGroup
from rclpy.executors import MultiThreadedExecutor

self.group_a = MutuallyExclusiveCallbackGroup()
self.group_b = MutuallyExclusiveCallbackGroup()
self.sub_a = self.create_subscription(
    InputMsg, 'a', self.on_a, 10, callback_group=self.group_a)
self.timer_b = self.create_timer(
    0.05, self.on_b, callback_group=self.group_b)

# 節點初始化完，在 main 裡執行：
executor = MultiThreadedExecutor(num_threads=2)
executor.add_node(node)
executor.spin()
```

這是放入現有 Node 的**示意修改片段**，`InputMsg`、`node` 等要依專案替換，不是可獨立執行的整份程式。

更改前先問：A/B 是否修改同一個 dict、list、counter？B 是否必須等 A 完成？是否有同步 Service Call 可能死結？有任一項未釐清，就不能只為了「並行」直接改。

## 方案 3：Python 的 CPU 密集工作交給 Process

在一般啟用 GIL 的 CPython 中，兩個純 Python 計算執行緒通常無法同時在不同核心執行 Python 位元碼。如果瓶頸是 CPU 計算，不要期待只加執行緒就能線性加速。可把獨立計算放到另一個 process，但會增加序列化、傳輸與同步成本，並且結果可能晚到或亂序。

```python
# 示意：只能把可 pickle 的純計算函式交給 ProcessPoolExecutor。
# 真正 ROS 2 Node 的 Publisher / Subscription 不應直接跨 process 傳入。
from concurrent.futures import ProcessPoolExecutor

pool = ProcessPoolExecutor(max_workers=2)
# future = pool.submit(pure_calculation, data)
```

不要直接在 Callback 裡 `future.result()` 阻塞等待，否則依然可能把 Executor 卡住。要設計如何非同步接收結果與處理關閉。先用小規模 benchmark 測「計算時間 - 傳輸成本」，再決定是否值得。

## 如何知道改動真的有用

記錄同一負載下的 Callback 等待時間、處理時間、端到端延遲 p50/p95、吞吐量、CPU/記憶體與正確性。比較時保留原版；不能把「兩個 log 交錯出現」當成整體效能一定提高。

來源：[ROS 2 Jazzy Executors](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html)、[Callback Groups](https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html)、[Python concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html)。
