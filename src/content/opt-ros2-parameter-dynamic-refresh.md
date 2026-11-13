---
id: opt-ros2-parameter-dynamic-refresh
title: ROS 2 參數可設定成功，不代表 Callback 已採用新值
category: ROS 2
tags: ROS 2, ros2-parameters-config, 考場判讀
aliases: opt-ros2-parameter-dynamic-refresh, ROS 2 參數可設定成功，不代表 Callback 已採用新值
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html
verified: false
updated_at: 2026-11-13
summary: 把「驗證參數」和「成功後更新運行狀態」分開。
related: ncku-v2-ros2-parameters-config
---

# ROS 2 參數可設定成功，不代表 Callback 已採用新值

## 易錯觀念

`add_on_set_parameters_callback` 用於檢查即將設定的參數是否允許，回傳成功／失敗；它本身**不應被當成「參數一定已設定完成」的證明**。若正在執行的 callback 讀取先前快取值，可能仍用舊設定；此外，並行 callback 還可能需要同步。

## rclpy Node 內的驗證片段（只做語法示意）

```python
from rcl_interfaces.msg import SetParametersResult

def validate_params(self, params):
    for p in params:
        if p.name == 'batch_size' and (type(p.value) is not int or p.value <= 0):
            return SetParametersResult(successful=False, reason='batch_size must be positive integer')
    return SetParametersResult(successful=True)

# 在 Node 初始化時：
# self.add_on_set_parameters_callback(self.validate_params)
# 在真正執行的處理流程中重讀參數，或採用官方 post-set 同步機制。
```

**以上是 class 方法及初始化概念片段，未在 rclpy Jazzy 執行**。若使用 post-set callback，必須先核對當前 Python API 是否提供與何時觸發；別把 rclcpp 的 C++ 語法原樣複製到 Python。

## 驗收

先設一個合法值，驗證下一次工作實際採用的值有變；再設負數／錯型別，應回絕且既有工作維持舊值。再測多 callback 並行時是否需要互斥。若考場只需要固定參數，讀一次後重啟 Node 有時反而更容易保證正確。

## 來源與驗證界線

- 參考：https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 設定值與程式真正用到的值，是兩件事

假設 Node 啟動時做了這件事：

```python
# Node __init__ 裡面的概念片段
self.declare_parameter('batch_size', 16)
self.batch_size = self.get_parameter('batch_size').value
```

稍後用 `ros2 param set /worker batch_size 32`，ROS 2 參數系統可能已經保存 32；可是 `self.batch_size` 是你之前複製出來的普通 Python 數字，**它不會自己變 32**。因此 `get_parameter()` 顯示新值，也不代表 `on_message()` 已經改用新值。

對照兩個方案：

- 工作次數不多、參數讀取代價可接受：Callback 每次用 `self.get_parameter('batch_size').value` 取得當前值。要留意參數型別、是否已宣告和並行狀態。
- Callback 很密集、想快取數值：要明確指定何時更新快取，並確認更新與工作執行的同步關係；使用者按下設定後，不能只看 CLI 回覆成功就說新行為已生效。

### 驗收小測試（不需實際改硬體）

建立一個計數器，每次 Callback 印出**實際採用的 batch_size**。先執行三次確認是 16，再把參數改為 32，觀察下一次是否採用 32。接著設定 `0` 或錯誤型別，應被擋下並保留有效設定。這比只看 `ros2 param get` 更能證明功能正確。

若使用 `add_on_set_parameters_callback`，那主要是驗證**是否允許設定**；不是「裡面做副作用就一定安全」的保證。不同版本的 rclpy 實作應對照當前官方 API。考場若只要求固定值，明確在啟動時設定並重新啟動 Node，常比設計一整套動態熱更新更省錯誤。
