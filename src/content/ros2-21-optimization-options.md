---
id: ros2-21-optimization-options
title: ROS 2 Callback：效能瓶頸與替代優化方法
category: ROS 2
tags: ros2, callback, executor, qos, gil, parallelism, batching, optimization
aliases: ROS 2 太慢, callback 效能, subscriber 延遲, MultiThreadedExecutor, ReentrantCallbackGroup, KEEP_LAST, GIL, 合併指令, 訊息積壓
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/
verified: true
updated_at: 2026-11-10
summary: 從目前 Callback 的瓶頸反查可行解法：優化計算、並行、QoS、減少重複工作和指令合併。
related: ros2-21-official-demo
---

## 範圍提醒

本篇是**在成大官方 2-1 Demo 基礎上的額外學習與優化構想**；官方演練本身主要要求熟悉 ROS 2 CLI、node/topic 與除錯，**沒有宣稱以下技術就是正式考題**。

## 先分辨瓶頸類型

假設 Publisher 每秒產生 10 筆資料，而 Subscriber 每處理一筆花 0.3 秒。

若只有一條依序執行的處理路徑，理想最大處理量是 1 / 0.3 ≈ **3.33 筆／秒**，低於輸入速率。但這還不足以判定應該調整哪個參數。

優先分辨：

- **CPU 計算**：Callback 在演算法、迴圈、資料轉換上耗時？
- **等待 I/O**：Callback 是否在等網路、磁碟或外部裝置？
- **排隊／排程**：Callback 本身很快，但被其他工作阻塞，或訊息已經積壓？
- **傳輸／QoS**：兩端 QoS 不相容、封包遺失或資料保留策略不符合需求？
- **重複工作**：某些訊息或計算本來就可以不做、合併或快取？

例如 Callback 只花 0.01 秒，但訊息卻延遲 2 秒，應先檢查排程、積壓、傳輸與端到端時間，而不是直接重寫計算函式。

## 搜尋「Callback 太慢」時可考慮的解法

| 方案 | 何時值得試 | 主要改善 | 重要限制 |
| --- | --- | --- | --- |
| 優化演算法／資料結構 | 大量 CPU 運算、存在重複掃描 | 單筆延遲與 CPU 用量 | 必須先確認真正熱點 |
| 快取／避免重複計算 | 相同輸入反覆出現且結果可重用 | 總運算量 | 快取失效、記憶體成本 |
| 合併相鄰操作（Coalescing） | 連續指令可以合成等價操作 | 執行次數與固定開銷 | 不可破壞順序、中間狀態與安全檢查 |
| 批次處理（Batching） | 每次處理有高固定成本、允許累積 | 每筆攤提成本與吞吐量 | 可能增加等待延遲 |
| QoS KEEP_LAST／Depth 調整 | 舊訊息可以被新訊息取代 | 積壓與資料新鮮度 | 可能跳過訊息；不會取消正在執行的 Callback |
| MultiThreadedExecutor + Callback Group | Callback 可安全重疊，尤其 I/O 等待 | 吞吐量與等待時間 | 預設互斥 Group 仍可能序列化；共享狀態需同步 |
| Multiprocessing／獨立計算行程 | 純 Python CPU 計算是主要瓶頸且有多核心 | 多核心並行能力 | 序列化、行程通信、啟動及記憶體成本 |
| 拆開訊息接收與重運算 | 接收不能長時間被處理阻塞 | 接收反應與排程 | 需處理背壓、佇列大小與結果順序 |

上表是候選方向，不是保證有效的排名。請用符合題目語義的方式挑選，並比較實際時間與正確性。

## 1. Callback 與 Executor

- **Callback**：例如訂閱 /number 後的函式，收到 msg 時負責處理。
- **Executor**：安排 ROS 2 的 Callback 何時被執行。
- **SingleThreadedExecutor**：同一時間僅有一個 Callback 在該執行器上執行。
- **MultiThreadedExecutor**：可以由多個 Thread 安排 Callback，但是否能重疊執行還受 Callback Group 約束。
- **MutuallyExclusiveCallbackGroup**：同一 Group 內的 Callback 不會重疊；它是一般 ROS 2 Node 的預設 Group。
- **ReentrantCallbackGroup**：允許 Group 內 Callback 重疊，**甚至同一個 Callback 的不同呼叫也可能重疊**；因此要確認程式可重入、資料競爭與執行順序。

ROS 2 官方指出：如果所有 Callback 都放在預設的 Mutually Exclusive Group，即使改成 MultiThreadedExecutor，也可能表現得如同單執行緒。

範例（展示設定方式，**不表示所有程式都應改成此模式**）：

~~~python
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.executors import MultiThreadedExecutor

# 在 Node 的 __init__ 內保留 callback group 參考
self.group = ReentrantCallbackGroup()
self.sub = self.create_subscription(
    Int32, '/number', self.callback, 10,
    callback_group=self.group,
)

# 啟動時可使用：
executor = MultiThreadedExecutor(num_threads=4)
executor.add_node(node)
executor.spin()
~~~

若修改同一份共享狀態、或要求處理順序，不能只為了並行就換成 Reentrant。

參考：[ROS 2 Callback Groups 官方文件](https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html)。

## 2. Python GIL：Thread 不一定能加速 CPU 計算

CPython 是常見的 Python 實作。傳統有 GIL 的 CPython 通常無法讓同一 Process 內的多個 Thread 同時執行純 Python 位元碼，因此：

- **I/O 等待型** Callback：Thread 可能讓等待重疊。
- **純 Python CPU 密集型** Callback：單純增加 Thread 通常不會讓運算隨核心數線性加速。
- **Multiprocessing**：多個獨立 Process 可以在多個 CPU 核心上運行，但傳送資料、建立行程和收集結果有成本。
- 某些會釋放 GIL 的 C 擴充或 free-threaded CPython 的情況不同；要依考場實際執行環境確認。

當每筆工作只有極短時間（例如 0.001 秒），多行程的額外成本可能超過節省的計算時間。

## 3. QoS：不需要所有歷史資料時，考慮減少積壓

ROS 2 QoS 的 **KEEP_LAST + Depth = 1** 可讓訂閱端的訊息歷史保留最新一筆，而不是無限制保留舊樣本：

~~~python
self.sub = self.create_subscription(
    Int32,
    '/number',
    self.callback,
    1,  # KEEP_LAST depth=1 的常見簡寫
)
~~~

- 合適例子：只關心最新狀態的感測讀數、當前位置、目前目標值。
- 不合適例子：每筆交易或每個動作都必須執行的命令。
- **注意**：Depth=1 不等於中斷正在處理的 Callback；也不保證端到端永遠零延遲。
- **Reliability**（RELIABLE / BEST_EFFORT）影響資料傳遞策略；並非「應用一定處理過每筆指令」的保證。
- Publisher 和 Subscriber 的 QoS 還必須彼此相容，否則可能收不到訊息。

參考：[ROS 2 QoS 官方說明](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)。

## 4. 使用者提出的優化方向：合併「相鄰而且可合併」的命令

例如待執行序列：

~~~text
前進 10cm, 前進 10cm, 前進 10cm, 左轉 90°, 後退 10cm, 後退 10cm
~~~

如果指令的規格允許「同方向移動可累加距離」，且每段中間沒有強制停止、感測、確認或其他副作用，可改成：

~~~text
前進 30cm, 左轉 90°, 後退 20cm
~~~

只合併**連續且語義等價**的項目；不能跳過中間不同指令去合併。這類思路可稱為 **Command Coalescing / Run-Length-style Aggregation**。

這種方法可能減少解析、派送及啟動的固定開銷，甚至減少部分重複計算；但若耗時主要來自實際移動距離，總時間不一定顯著下降。

它不等同於 ROS 2 QoS：QoS 是訊息儲存／傳遞策略；Command Coalescing 是**應用層**確認語義後重新安排工作量。

## 複製給考場 LLM：尋找替代優化方案

~~~text
Current system: ROS 2 publisher/subscriber with callback-based processing.
Please identify the actual bottleneck from the code and measurements before assuming it is the callback computation.

Check these alternative optimization directions when applicable:
1. Faster algorithm / data structure, or eliminate repeated work.
2. Caching or precomputation for repeatable inputs.
3. Application-level batching or coalescing adjacent equivalent operations without changing required behavior or order.
4. QoS history/depth changes only if dropping stale messages is allowed.
5. MultiThreadedExecutor with suitable callback groups for safe concurrency, particularly I/O-bound callbacks.
6. Multiprocessing or native code for CPU-bound Python workloads when GIL and overhead matter.
7. Queue/backpressure design and decoupling message receipt from slow processing.

For each relevant option, explain correctness constraints, costs, and what metric may improve. Choose a promising option and implement working code directly. Do not assume all options are faster; preserve the specified behavior and propose a concrete validation method.
~~~

## 參考

- [ROS 2 Jazzy 官方文件](https://docs.ros.org/en/jazzy/)
- [ROS 2 Callback Groups](https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html)
- [ROS 2 QoS](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [Python threading / GIL](https://docs.python.org/3/library/threading.html)
- [Python multiprocessing](https://docs.python.org/3/library/multiprocessing.html)
