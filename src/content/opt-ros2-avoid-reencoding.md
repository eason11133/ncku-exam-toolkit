---
id: opt-ros2-avoid-reencoding
title: ROS 2 Callback 中避免不必要的反覆轉字串
category: ROS 2
tags: ROS 2, ros2-message-serialization, 考場判讀
aliases: opt-ros2-avoid-reencoding, ROS 2 Callback 中避免不必要的反覆轉字串
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Tutorials/Demos/Intra-Process-Communication.html
verified: false
updated_at: 2026-11-13
summary: 先量出重複編解碼成本，再移除可證明等價的轉換。
related: ncku-v2-ros2-message-serialization
---

# ROS 2 Callback 中避免不必要的反覆轉字串

## 常見問題

收到訊息後反覆做 `str()`、JSON encode/decode、`list()`，再丟進下一個處理函式，可能浪費 CPU 或建立臨時物件。不過 ROS 2 **訊息型別固定**，不能為了少一次轉換就把 `Int32` 當成 `String`，也不能把 Python container 直接當成所有 ROS 2 message 欄位。

## 純 Python 完整示意：只解一次 JSON

<!-- test: full-python -->
```python
import json
sample = '{"x": 12, "y": 30}'
parsed_once = json.loads(sample)
answer = parsed_once["x"] + parsed_once["y"]
assert answer == 42
print(answer)
```

在真正的 rclpy callback 內先看 `msg.data` 的**實際 ROS message type**；若欄位本來就已是整數，就直接用它，不要先轉字串再 `int()`。上面的 Python 只驗證解析邏輯，沒有宣稱它是一個能獨立啟動的 ROS 2 Node。

## 驗收

固定相同輸入訊息和型別，量 callback 自身耗時與 end-to-end latency；比對輸出 value、type、順序、數量。若要跨 Process 傳送，實際 RMW/DDS 的 serialization 由 middleware 管理，不可用純 Python 的 JSON benchmark 代替整個 ROS 2 通訊耗時。

## 來源與驗證界線

- 參考：https://docs.ros.org/en/jazzy/Tutorials/Demos/Intra-Process-Communication.html
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。

## 延伸推演｜遇到變形題怎麼判斷

## 一個字串往返轉三次，可能根本不需要

假設 ROS 2 callback 收到一個已經是整數的 `msg.data`，你先 `str()` 變成字串，又 `int()` 轉回整數，算完再 `str()`。這段中間轉換如果沒有真正的輸出格式要求，就可能是多餘工作。

但別直接把所有轉換刪掉。對外通訊的 Message Type 是契約：`std_msgs/msg/Int32` 的資料應照該型別處理；若你真的收到文字訊息，來源可能包含空字串、負號、無效字元，解析錯誤也要處理。比較時要用相同輸入和錯誤樣本，確認移除轉換後的語意一樣。

**紙筆題：** 傳來字串 `"007"`，原本流程轉成整數再輸出 `"7"`。如果需求是保留原始識別碼，這個轉換從一開始就是錯的；最佳化之前先查資料是「數值」還是「有前導零的文字 ID」。
