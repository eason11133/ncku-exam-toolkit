---
id: opt-ros2-async-service
title: ROS 2 Service 卡住：先檢查同步等待與 Callback Group
category: ROS 2
tags: ROS2,service,client,call_async,Future,callback group,deadlock
aliases: 服務死鎖,ROS service call_async,spin_until_future_complete,Service timeout
source_type: personal
source_url: https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html
verified: false
updated_at: 2026-11-13
summary: 在考場遇到 ROS 2 Service 沒回應時，分清伺服器不存在、同步阻塞和 callback group 排程問題。
related: opt-ros2-topic-domain-qos
priority: P0
difficulty: advanced
---

# Service 沒回應，不一定是 Server 壞掉

ROS 2 Service 是 Request／Response。Client 把請求發出去後，回應仍需由 Executor 處理。如果你在某個 Callback 裡同步等待，而等待結果需要執行的 Callback 又受相同互斥 Callback Group 限制，可能形成死鎖。增加 `timeout` 或 Thread 數不一定解決；要先分清 Executor、Callback Group 與同步等待的關係。

另一種更基本的原因是 Service 根本沒啟動、名稱或型別錯誤。先用 `ros2 service list -t`、`ros2 node info /node_name` 查存在性，必要時查 Node log。**先確認有 Server 再談死鎖。**

## rclpy 的非同步模式（完整 Python 範例；需 ROS 2 Jazzy 與 example_interfaces）

```python
import rclpy
from rclpy.node import Node
from example_interfaces.srv import AddTwoInts

class Client(Node):
    def __init__(self):
        super().__init__('async_example_client')
        self.client = self.create_client(AddTwoInts, 'add_two_ints')
        self.pending = None
        self.timer = self.create_timer(1.0, self.send_if_ready)

    def send_if_ready(self):
        if not self.client.service_is_ready():
            self.get_logger().info('waiting for service')
            return
        if self.pending is not None and not self.pending.done():
            return  # 避免請求尚未返回又無限堆積新請求
        req = AddTwoInts.Request()
        req.a = 2
        req.b = 3
        self.pending = self.client.call_async(req)
        self.pending.add_done_callback(self.on_response)

    def on_response(self, future):
        try:
            response = future.result()
            self.get_logger().info(f'sum={response.sum}')
        except Exception as exc:
            self.get_logger().error(f'service failed: {exc}')

def main():
    rclpy.init()
    node = Client()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.try_shutdown()

if __name__ == '__main__':
    main()
```

這支程式**語法上完整，但需要 ROS 2 套件及一個提供 `/add_two_ints` 的 Server 才會拿到 `sum=5`**；此處沒有在 ROS 2 實際執行，所以不能宣稱 runtime 測試通過。它每秒檢查是否可以再發一筆請求，示範如何避免在 Timer Callback 內呼叫阻塞式 `.result()` 等待。

## 有了 call_async 還要想什麼？

`call_async` 不代表可以無限制送 Request。你要有 pending、逾時、失敗、重試與關閉的處理。上面為了讓例子簡短，只避免未完成時重複發送，**還沒示範真正 timeout／取消／指數退避**，不應直接用在高負載正式服務上。

如果真要讓不同 Callback 同時執行，MultiThreadedExecutor 與 Callback Group 的配置需要一起檢查；兩個 Callback 若仍在同一個 `MutuallyExclusiveCallbackGroup`，單純增加 Thread 並不會讓它們重疊。不同 Callback Group 同時執行時，還需要保護共享資料。純 Python CPU-heavy 工作也不會因為把 Executor 換成多執行緒，就保證跨核心變快。

## 驗收順序

先確認 Service 出現、型別正確、請求送出，再檢查完成回呼是否執行；測 Server 未啟動、晚啟動、回傳例外、長時間無回覆、Ctrl-C 關閉。每次分開記錄「請求是否成功」和「請求耗時」，不要把沒有等待的瞬間返回算作完整 Service 已成功。

---

## 深讀：`call_async` 不是「呼叫後立刻得到答案」

把 Service 想成到櫃台送申請單。`call_async(request)` 做的是**送出請求並拿回一張領件單（Future）**，不是當場得到處理結果。

1. Callback A 收到資料，需要問 Service B 一個值。
2. A 呼叫 `future = client.call_async(request)`，留下 `request_id` 和 Future，**讓 A 返回**。
3. Executor 繼續處理其他 Callback；B 回覆時，Future 標成完成。
4. 完成 Callback 才取回 response，核對這筆答案屬於哪個 request，再做後續處理。

```python
# 放在已建立好 client 的 ROS 2 Node 內，非獨立 Python 程式
future = self.client.call_async(request)
future.add_done_callback(lambda done, rid=request_id: self.on_service_done(rid, done))

# on_service_done 內先處理 exception/取消，再讀 done.result()
```

**常見假修正：**

```python
future = self.client.call_async(request)
result = future.result()  # 沒先確認完成，現在未必有結果；不是同步等待的正確替代
```

更危險的是在同一個受限制的 Callback 裡用 `spin_until_future_complete` 之類同步等待，又把 executor／group 卡住。要先核對 Jazzy 的 API、既有 executor、group 設定與原本 Service 的順序要求。

**變形題：** 送出 request #7、#8，#8 先回來。如果題目要按照「誰先送就誰先輸出」，完成 Callback 不能直接按回來時間輸出；要保存序號與結果，等 #7 就緒再依序提交。Async 改善等候方式，**不會自動維持需求中的順序**。

**驗收：** 服務拒絕、逾時、取消、重複 callback、回覆亂序時怎麼處理；這些比單測一次成功更能驗證設計。
