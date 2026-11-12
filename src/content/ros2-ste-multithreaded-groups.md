---
id: ros2-ste-multithreaded-groups
title: SingleThreadedExecutor：改用 MultiThreadedExecutor 與 Callback Group
category: ROS 2
tags: ROS 2,Executor,Callback Group,MultiThreadedExecutor,並行處理
aliases: MultiThreadedExecutor,MutuallyExclusiveCallbackGroup,多執行緒
source_type: personal
source_url: https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html
verified: false
updated_at: 2026-11-12
summary: 允許彼此獨立的 Callback 在等待時重疊處理，但必須同時滿足執行緒、群組和資料安全條件。
related: ros2-ste-short-callback,ros2-ste-process-pool
priority: P0
difficulty: intermediate
---

# 多條執行緒，為什麼 B 還是可能得等 A？

## 30 秒判斷

假設 ROS 2 Node 收到感測器訊息，要呼叫函式 A。A 正在等設備回傳資料，等 0.35 秒才能結束。這時候計時器 B 到了，卻一直沒被執行。

你可以考慮 `MultiThreadedExecutor`，但要同時確認：

1. **Executor 至少有兩條執行緒**，一條處理 A，另一條才能處理 B。
2. **ROS 2 允許 A、B 重疊執行**：它們不能待在同一個 `MutuallyExclusiveCallbackGroup` 裡。
3. **A、B 實際上可以安全重疊**：不能依賴「A 先完成 B 才能開始」，也不能沒有保護地同時改同一份資料。

三個條件少一個，改成多執行緒也可能無效或算出錯誤結果。這就是「有機會一起執行」真正受哪些規則限制。

## 原本發生了什麼？

`Executor` 可以先想成「決定哪個 Python 函式現在輪到執行」的機制。`Callback` 就是 ROS 2 收到訊息、計時器時間到了等事件時執行的函式。

在 `SingleThreadedExecutor` 中，只有一條執行緒負責跑它們：

```text
時間向右 →
單執行緒： [ A 開始 ─ 等待設備 ─ A 結束 ][ B 開始、結束 ]
```

B 不是自己很慢，而是 A 沒有返回前，這條執行緒無法跑 B。當你加上另一條執行緒，才具備同時處理 A、B 的硬體／執行條件。

**但為什麼兩條執行緒還不夠？** 因為 ROS 2 另有一個規則：每個 Callback 會屬於一個 Callback Group。它就像告訴執行器「這幾件工作可不可以重疊」。未指定群組時，Node 的預設群組是 *互斥* 的，也就是同一群組任何兩個 Callback 都不會同時執行。所以光換 `MultiThreadedExecutor`，兩個仍在預設群組的工作，仍可能一個做完另一個才開始。 <https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html>

如果確認 A、B 可以安全重疊，將它們放進**不同**的互斥群組（即 `MutuallyExclusiveCallbackGroup`）後，每個群組內的工作仍不會自己重疊，但兩個群組之間可以交錯進行：

```text
時間向右 →
執行緒 1：[ A 開始 ─ 等待設備 ───────── A 結束 ]
執行緒 2：           [ B 開始、結束 ]
```

「可以重疊」表示排程規則允許，並不保證 B 一定在某個固定毫秒開始：它還受到 OS 排程、CPU 忙碌程度、其他 Callback、資料是否已抵達等因素影響。**能不能重疊，和整體效能是否提升，要分別測。**

## 怎麼改？先看一份可操作的教學程式

下面只有兩個 Timer，不依賴考題裡未知的感測器或服務：A 每次睡 0.35 秒（刻意模擬 I/O 等待）；B 每 0.1 秒執行一次。`sleep` 是教學用的阻塞情境，不是建議你把真實 Callback 改成 `sleep`。

前提：ROS 2 **Jazzy** 已安裝且可用 `rclpy`。以下程式 **只做 Python 語法檢查，尚未在 ROS 2 Jazzy 實際執行**。

```bash
source /opt/ros/jazzy/setup.bash
python3 ros2_executor_overlap_demo.py single
# 觀察 A start／A end 間是否有 B run，Ctrl+C 停止
python3 ros2_executor_overlap_demo.py multi
# 再觀察一次，Ctrl+C 停止
```

完整檔案隨資料包附於 `examples/ros2_executor_overlap_demo.py`：

```python
import sys
import time

import rclpy
from rclpy.callback_groups import MutuallyExclusiveCallbackGroup
from rclpy.executors import MultiThreadedExecutor, SingleThreadedExecutor
from rclpy.node import Node

class OverlapDemo(Node):
    def __init__(self):
        super().__init__("overlap_demo")
        self.start_time = time.perf_counter()
        self.group_a = MutuallyExclusiveCallbackGroup()
        self.group_b = MutuallyExclusiveCallbackGroup()
        self.timer_a = self.create_timer(0.8, self.callback_a, callback_group=self.group_a)
        self.timer_b = self.create_timer(0.1, self.callback_b, callback_group=self.group_b)

    def log(self, message):
        elapsed = time.perf_counter() - self.start_time
        self.get_logger().info(f"{elapsed:7.3f}s {message}")

    def callback_a(self):
        self.log("A start")
        time.sleep(0.35)  # 示範等待
        self.log("A end")

    def callback_b(self):
        self.log("B run")

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"single", "multi"}:
        print("Usage: python3 ros2_executor_overlap_demo.py [single|multi]")
        raise SystemExit(2)
    rclpy.init()
    node = OverlapDemo()
    executor = (MultiThreadedExecutor(num_threads=2)
                if sys.argv[1] == "multi" else SingleThreadedExecutor())
    executor.add_node(node)
    try:
        executor.spin()
    except KeyboardInterrupt:
        pass
    finally:
        executor.shutdown()
        node.destroy_node()
        rclpy.shutdown()

if __name__ == "__main__":
    main()
```

### 怎麼看結果？

假設單執行緒的某次日誌是：

```text
0.800s A start
1.150s A end
1.150s B run
```

B 在 A 結束後才執行。若改多執行緒後看到：

```text
0.800s A start
0.802s B run
1.150s A end
```

B 的紀錄出現在 A 開始與結束之間，**這次確實重疊執行了**。以上時間只是為了教你判讀而寫的「示意日誌」，不是實際跑出的測試結果。

如果多執行緒仍看不到 B 插進來，先查：是否真的設定兩條執行緒？A/B 的 `callback_group` 是否指定不同群組？群組物件是否保存成 `self.group_a`、`self.group_b`？還是 B 根本沒有準備好執行？

## 共享資料為什麼會出問題？

假設 A、B 都要把同一個計數器加 1。你原本想得到 `5 → 6 → 7`，但如果程式把「讀取、+1、寫回」分成數個步驟，可能變成：

```text
A 讀到 5
B 讀到 5
A 計算 5+1，寫回 6
B 計算 5+1，寫回 6
結果 6（不是 7）
```

這就叫「資料競爭或競爭條件」（這裡具體是 lost update）。不要以為 Python 有 GIL 就可以忽略跨 Callback 的共享狀態：即使每個單獨操作有其同步保證，分成數步的資料更新仍要看整個流程的正確性。能改成局部資料就盡量改；需要一起更新時，才考慮 Lock、訊息佇列或保留互斥群組，**不要只為了快就破壞順序**。

還有一個容易被忽略的情況：Callback A 裡面同步呼叫服務並等待結果，但處理那個結果的工作也在同一個互斥群組。A 不返回，處理結果的 Callback 就不能執行，最後可能一直等下去。這叫**死結**。ROS 2 文件特別提醒同步服務／Action 呼叫的群組設定風險；能改非同步時要先評估。 <https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html>

## 為什麼多執行緒不一定讓 CPU 計算更快？

Python 常見的 CPython 有個叫 GIL 的執行限制：在一般啟用 GIL 的版本裡，同一個 Python Interpreter 裡通常只有一條執行緒能同時執行 Python 位元碼。兩個 Callback 若都在跑純 Python 的大量 `for` 運算，不要因為用了兩條 Thread 就直接期待兩顆核心同時跑那兩段 Python 計算。但如果 A 是在等 I/O，B 在這段期間做事就有幫助；某些釋放 GIL 的原生函式庫也需要個別確認。 <https://docs.python.org/3.12/library/threading.html>

## 考場改程式前的檢查與測試

1. 看 `spin()`、Executor、`create_subscription()`／`create_timer()`，找出 A、B 的群組及共享資料。
2. 確認瓶頸是「A 卡住 B 的開始」，而不是訊息根本沒送到或 B 自己很慢。
3. 只有 A、B 可安全重疊時，才加 `MultiThreadedExecutor(num_threads=2)` 並分成不同群組。
4. 先檢查功能（輸出值、數量、先後順序、共享資料）；再看 A start / B run / A end 是否重疊。
5. 最後用**相同硬體與相同輸入**比較端到端延遲、吞吐、CPU、記憶體。重疊紀錄不能當成效能已提升的證據。

**不適合直接改**：無法確認共享資料安全、嚴格依賴順序、真正瓶頸是純 Python 計算，或根本沒有等待問題。這時先維持原版，改查其他方向。

**查證狀態**：原理依 ROS 2 Jazzy 官方文件與 Python 3.12 threading 文件；示範程式未在 ROS 2 環境執行；未做實際效能比較。

參考：[ROS 2 Jazzy Executors](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html)、[ROS 2 Jazzy Using Callback Groups](https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html)、[Python 3.12 threading](https://docs.python.org/3.12/library/threading.html)。
