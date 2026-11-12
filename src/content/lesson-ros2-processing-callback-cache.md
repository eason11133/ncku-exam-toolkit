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

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

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

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 資料是否真的不變已確認
- 定義何時失效重建

## 常見錯誤與代價

- 快取需占記憶體
- 舊資料可能造成錯誤

**正確性界線：**資料更新時必須失效，觀察快取正確性與 RSS。

## 怎麼做測試

固定設定做新舊結果比對，再測設定中途更新，檢查新值何時生效；量 callback duration。

優先觀察：執行時間、cache hit、記憶體。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **callback too slow** 或 **重複解析不變資料** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Python perf_counter](https://docs.python.org/3/library/time.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
