---
id: lesson-ros2-processing-callback-algorithm
title: 替換不必要的演算法
category: ROS 2
tags: rclpy callback, ROS 2 訊息處理 Callback, 效能優化
aliases: algorithm, ros2-processing-callback
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-12
summary: 例如只求最大值就避免整個排序。
related: ncku-ros2-executor
---

# 替換不必要的演算法

## 先弄懂這個問題

目前的方法是 **ROS 2 訊息處理 Callback**。訂閱 Callback 可能包含資料解析、計算與發布；應拆段計時，避免把整段耗時都歸咎 ROS。

這個方案的目的是：找最大值可用線性掃描，而排序通常需 O(n log n) 時間。

你可以先想像這個情境：Callback 每筆只要最大值，原本卻排序全部資料。

## 修改前：先看哪裡有問題

```python
largest = sorted(values)[-1]  # O(n log n)
```

## 修改後：對照實作

```python
largest = max(values)         # O(n)
```

## 逐步理解，為什麼這樣改

當資料非空且只需要最大值時，線性掃描就夠。`sorted` 通常會建立新列表並排序，既耗時間也耗記憶體；若後續還要用完整排序結果就不能刪。

## 什麼情況才適合

- 資料非空或有完整空輸入處理
- 替換前後語意相同

## 常見錯誤與代價

- 不同資料型態結果可能不同
- 實測才能知道整體收益

**正確性界線：** 對照隨機、邊界與空資料輸出是否一致。

## 怎麼做測試

測 n=1、大量資料、負數與重複值，檢查輸出相同；若空輸入允許，先明訂處理方式。

優先觀察：CPU、callback 執行時間、記憶體。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


Subscriber 已收到正確訊息，但 Callback 計算耗時，而且可證明演算法不必排序、重掃或重複解析時，先替換不必要的演算法。

## 參考文件與驗證狀態

- [Python perf_counter](https://docs.python.org/3/library/time.html)
