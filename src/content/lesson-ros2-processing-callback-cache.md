---
id: lesson-ros2-processing-callback-cache
title: 快取不會改變的初始化資料
category: ROS 2
tags: rclpy callback, ROS 2 訊息處理 Callback, 效能優化
aliases: cache, ros2-processing-callback
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-12
summary: 避免對同一份設定每次重新解析或配置。
related: ncku-ros2-executor
---

# 快取不會改變的初始化資料

## 先弄懂這個問題

目前的方法是 **ROS 2 訊息處理 Callback**。訂閱 Callback 可能包含資料解析、計算與發布；應拆段計時，避免把整段耗時都歸咎 ROS。

這個方案的目的是：把固定配置從高頻 Callback 移到初始化或資料更新點。

你可以先想像這個情境：每則訊息都重新讀同一個 JSON 設定檔。

## 修改前：先看哪裡有問題

```python
def on_msg(self, msg):
    config = json.loads(self.config_json)
    handle(msg, config["threshold"])
```

## 修改後：對照實作

```python
# 在 __init__ 裡
self.config = json.loads(self.config_json)
# callback 裡
def on_msg(self, msg):
    handle(msg, self.config["threshold"])
```

## 逐步理解，為什麼這樣改

改的是「設定何時解析」，不是省略設定。若設定會在運作中更新，必須在更新時重新解析，否則快取會讓結果錯。

## 什麼情況才適合

- 資料是否真的不變已確認
- 定義何時失效重建

## 常見錯誤與代價

- 快取需占記憶體
- 舊資料可能造成錯誤

**正確性界線：** 資料更新時必須失效，觀察快取正確性與 RSS。

## 怎麼做測試

固定設定做新舊結果比對，再測設定中途更新，檢查新值何時生效；量 callback duration。

優先觀察：執行時間、cache hit、記憶體。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


每筆 Callback 都解析完全相同且在運行期間不變的設定時，可以緩存解析結果；若參數會更新，必須有失效或更新機制。

## 參考文件與驗證狀態

- [Python perf_counter](https://docs.python.org/3/library/time.html)
