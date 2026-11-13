---
id: opt-ros2-topic-domain-qos
title: ROS 2 收不到訊息：從 Domain、Topic、Type 查到 QoS
category: ROS 2
tags: ROS_DOMAIN_ID,topic,QoS,namespace,remapping,debug
aliases: ROS domain,ROS2 收不到資料,QoS mismatch,topic no data,topic echo
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-13
summary: 幫助讀者依證據排除不同 Domain、名字、訊息型別和 QoS 不相容，避免亂改可靠性。
related: ops-ros2-environment
priority: P0
difficulty: intermediate
---

# 「有看到 Topic」不代表 Subscriber 一定收到

官方 2-1 Demo 是 `/publisher → /number → /processor → /double`。當 `/double` 沒資料時，不要直接改 Processor 演算法，應分辨是 Publisher 沒啟動、Node 沒被發現、Topic 名稱錯、訊息型別不同、QoS 不相容，還是 Callback 出錯。不同問題需要不同解法。

## 每個終端機都先查環境

```bash
# 在已載入 ROS 2 環境的 Linux/容器 shell 執行
printf 'ROS_DOMAIN_ID=%s\n' "${ROS_DOMAIN_ID:-<unset>}"
ros2 node list
ros2 topic list -t
ros2 node info /processor
ros2 topic info /number -v
```

這些是**檢查指令**；`/processor`、`/number` 要換成真實 Node／Topic。不同終端機、Docker 容器或另一台電腦若使用不同 `ROS_DOMAIN_ID`，端點可能互相看不到。當變數未設定，可能使用預設 Domain；不能只看某一個視窗就認定雙方相同。`ros2 node list` 看得到 Node，也仍須檢查 Topic 及 Type。

## `ros2 topic info -v` 看哪些欄位？

- Publisher 和 Subscription 的完整 Topic 名稱、端點是否存在。
- Message Type 是否一致；名稱相同、型別不同不是正常傳輸。
- **Reliability（可靠性）** 與 Durability（保留性）的 Request/Offered 是否相容。不能把深度 `depth` 當成「任何 QoS 不相容都能修」的設定。

例如 Publisher 提供 `BEST_EFFORT`，但 Subscriber **要求** `RELIABLE`，可靠性不相容，不能只把 `depth` 調大。反過來若 Publisher 提供 `RELIABLE`，Subscriber 要求 `BEST_EFFORT`，就不會因這項可靠性政策而不相容。也要核對其他 QoS 條件；不能只靠一欄判斷端點最終一定通。

## 能收到，但速度還是慢？

```bash
ros2 topic echo /number
ros2 topic hz /number
ros2 topic echo /double
```

CLI 這幾個指令**各自在同一個終端機執行會持續佔用終端機**，需要另外開視窗或按 Ctrl-C 結束前一個。先確認 `/number` 真能收到，再看 `/double`。如果上游有訊息但下游沒有，去看 `/processor` 的錯誤輸出和 Callback 邏輯；如果都有但頻率低，才做 Callback 分段計時和負載分析。

`ros2 topic echo` 與 `ros2 topic hz` 都是它們自己的 Subscriber，觀察值會受工具和 QoS 設定影響。當 CLI 訂閱者本身不相容時，也可能看起來「沒資料」；不能只憑一個 CLI 命令判死。

## 修之前要留什麼證據

留下兩端 `ROS_DOMAIN_ID`、`ros2 node list`、`topic list -t`、`topic info -v`、Node log 和可以重現的發送端資料。**先修通訊正確性，再處理吞吐／延遲**。若題目要求事件一筆不能漏，不能為了看到 `echo` 有資料就任意把可靠性改低。
## 用四個小情境分清楚問題在哪一層

**情境 A：Domain 不同。** Publisher 設 `ROS_DOMAIN_ID=7`，Subscriber 設 `ROS_DOMAIN_ID=8`。雙方可能互相發現不到，這時修改 `QoS depth` 毫無幫助；先讓它們處於同一個可互通的 Domain。

**情境 B：Topic 名稱不同。** A 發布 `/number`，B 訂閱 `/numbers`。差一個 `s` 就是不同通道。先列出完整 Topic 名稱，看 Namespace 或 Remapping 是否讓實際名稱變了。

**情境 C：同名但 Type 不同。** `/number` 一端是 `std_msgs/msg/Int32`，另一端要求不同 Type；名字相同也無法當成相容資料使用。`ros2 topic list -t` 和 `ros2 topic info -v` 是你要看的證據。

**情境 D：QoS 不相容。** Publisher 的 Reliability 是 `BEST_EFFORT`，Subscriber **要求** `RELIABLE`，這個搭配不能正常連接；反過來 Publisher 提供 `RELIABLE`、Subscriber 接受 `BEST_EFFORT`，在**可靠性這一項**是相容的，但仍要檢查 Durability 等其他政策。判斷方向是「Publisher 能提供什麼」對照「Subscriber 至少要求什麼」，不是一律選 Reliable 就會通。

### 觀察結果怎麼推理

| 看到的結果 | 下一步 |
|---|---|
| `ros2 node list` 連預期 Node 都沒有 | 查程序是否真的執行、ROS 環境與 Domain |
| 有 Node、沒有預期 Topic | 查程式的 Publisher/Subscriber 名稱、Namespace/Remapping |
| Topic 存在但無資料 | 查 Publisher 數、Message Type、QoS 和 CLI Subscriber 的 QoS |
| `/number` 有值，`/double` 沒值 | 查 Processor 是否處理到 Callback、輸出名稱和 Log |
| 都能收到但延遲高 | 才開始做 Callback 耗時、Queue 與執行器分析 |

請注意：`ros2 topic hz` 得到的是**這個 CLI 訂閱者觀測的頻率**，不是 Publisher 的硬體時鐘。它也會受訊息掉落、排程和 QoS 影響。

**動手推理：** 若 Node A 發 10 次，Node B 收到 7 次，不能直接結論是演算法慢。先查 QoS、資料流路徑，再追訊息序號。如果題目要求十筆全部收到，就不能用「改成 Best Effort 比較快」當作正確修正。

---

## 深讀：看到「Node 正常」，仍可能完全收不到訊息

請把它拆成四個互不相同的關卡：

| 關卡 | 你看什麼 | 例子 |
|---|---|---|
| Domain | `ROS_DOMAIN_ID` 是否一致 | Publisher 在 7、Subscriber 在 8，可能互相發現不到 |
| Topic 名稱 | 完整名稱、namespace、remap | `/number` 與 `/robot/number` 不一樣 |
| Type | 發布和訂閱是否用相容的介面型別 | 只同名但型別不同仍不能正常接收 |
| QoS | Requested 和 Offered 是否相容 | 需求 `RELIABLE`、提供 `BEST_EFFORT` 時不相容 |

以 Reliability 這個維度為例（其他 QoS 政策仍需另外檢查）：

| Publisher 提供 | Subscriber 要求 | 是否相容 |
|---|---|---|
| `RELIABLE` | `RELIABLE` | 是 |
| `RELIABLE` | `BEST_EFFORT` | 是 |
| `BEST_EFFORT` | `RELIABLE` | **否** |
| `BEST_EFFORT` | `BEST_EFFORT` | 是 |

別把「Publisher 已經送了」直接當成 Subscriber 一定收到。用 `ros2 topic list -t` 確認 Topic／Type，用 `ros2 topic info /number -v` 檢查端點和 QoS，再用 `ros2 topic echo /number` 觀察實際接收內容。QoS mismatch 不能靠盲目增加 Queue depth 修好。

**小題目：** `ros2 topic hz` 只看到 8 Hz，能斷言 Publisher 設成 8 Hz 嗎？不能。CLI 是接收端量測，會受到丟訊息、排程、QoS、負載等影響。應交叉檢查 Publisher 設定與端到端收件序號。

這張表是官方 ROS 2 Reliability 政策的簡化判斷，**不是實際 ROS 2 Jazzy 網路實驗**；Durability、History 等其他 QoS 欄位要另外確認。

