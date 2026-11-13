---
id: opt-ros2-parameterize-knobs
title: ROS 2 調參前，先宣告與記錄參數
category: ROS 2
tags: ROS 2, ros2-parameters-config, 考場判讀
aliases: opt-ros2-parameterize-knobs, ROS 2 調參前，先宣告與記錄參數
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html
verified: false
updated_at: 2026-11-13
summary: 把頻率與批次大小寫成參數並記錄預設值與可用範圍。
related: ncku-v2-ros2-parameters-config
---

# ROS 2 調參前，先宣告與記錄參數

## 何時適合

同一個 Node 要在不同工作量下測 `batch_size` 或 `publish_hz`，若每輪都改程式碼，容易混入其他變數。參數可以讓調整可重現，但**不是所有 CLI 設定都會自動改變正在使用的計算結果**。

## rclpy Node 片段（非可獨立執行）

```python
# 放在 class Node 的 __init__，並確定已先 super().__init__(...)
self.declare_parameter('batch_size', 16)
value = self.get_parameter('batch_size').value
if not isinstance(value, int) or value <= 0:
    raise ValueError('batch_size must be > 0')
self.batch_size = value
```

CLI（需 Jazzy 與 Node 正在運作）：

```bash
ros2 param list /my_node
ros2 param get /my_node batch_size
ros2 param set /my_node batch_size 32
```

注意這段只在 `__init__` 讀一次；後面 `param set` 雖可能回覆成功，`self.batch_size` **仍可能不更新**。動態參數需要 callback 或明確的重新讀取策略。

**驗收**：測缺參數、負數、超大值、動態修改與重啟；記下每次運行的 commit、參數值與輸出，不要把異常的高 batch_size 當成正常效能改善。

## 來源與驗證界線

- 參考：https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 深讀延伸｜把原理放進真實情境
## Parameter 改成功了，程式卻沒變？

想像 Node 初始化時只做一次 `self.batch_size = self.get_parameter('batch_size').value`。你執行 `ros2 param set /node batch_size 32` 後，**伺服端可能接受這個新參數值**，但 `self.batch_size` 是先前存下的 Python 整數，不會自己變成 32。你若又拿舊值跑效能測試，就會得到看似三組參數、實際卻都相同的結果。

可以選擇每次使用前查參數、用 parameter callback 更新內部狀態，或規定改參數後重啟 Node；三種方式的時效、鎖和錯誤處理不同。不要在有多條 Callback 時隨意更新多個相互依賴的設定；可能出現 `batch_size` 是新版，`deadline_ms` 卻仍是舊版的中間狀態。

測試不只驗證 `ros2 param get`：還要讓程式在安全的地方輸出**實際採用的值**，並確認輸入相同時產生正確結果。每次試驗記下 Node 版本、完整參數、工作量、輸出正確性和耗時分布。CLI 是 ROS 2 環境操作模板，沒有在此離線包實機執行。
