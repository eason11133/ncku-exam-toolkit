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

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```python
largest = max(values)         # O(n)
```

## 逐步理解，為什麼這樣改

當資料非空且只需要最大值時，線性掃描就夠。`sorted` 通常會建立新列表並排序，既耗時間也耗記憶體；若後續還要用完整排序結果就不能刪。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 資料非空或有完整空輸入處理
- 替換前後語意相同

## 常見錯誤與代價

- 不同資料型態結果可能不同
- 實測才能知道整體收益

**正確性界線：**對照隨機、邊界與空資料輸出是否一致。

## 怎麼做測試

測 n=1、大量資料、負數與重複值，檢查輸出相同；若空輸入允許，先明訂處理方式。

優先觀察：CPU、callback 執行時間、記憶體。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **callback too slow** 或 **重複解析不變資料** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Python perf_counter](https://docs.python.org/3/library/time.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
