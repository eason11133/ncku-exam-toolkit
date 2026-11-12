---
id: lesson-ros2-processing-callback-instrument
title: 分段計時找到真正瓶頸
category: ROS 2
tags: rclpy callback, ROS 2 訊息處理 Callback, 效能優化
aliases: instrument, ros2-processing-callback
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-12
summary: 用 perf_counter 比較 parse、compute、publish；不要猜哪個慢。
related: ncku-ros2-executor
---

# 分段計時找到真正瓶頸

## 先弄懂這個問題

目前的方法是 **ROS 2 訊息處理 Callback**。訂閱 Callback 可能包含資料解析、計算與發布；應拆段計時，避免把整段耗時都歸咎 ROS。

這個方案的目的是：比較各步耗時，優先修改佔比最大的步驟。

你可以先想像這個情境：訂閱者收到訊息後很慢，卻不知道是解析、計算還是 publish 慢。

## 修改前：先看哪裡有問題

```python
def callback(self, msg):
    data = parse(msg)
    output = compute(data)
    self.publisher.publish(output)
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```python
from time import perf_counter

def callback(self, msg):
    t0 = perf_counter()
    data = parse(msg)
    t1 = perf_counter()
    output = compute(data)
    t2 = perf_counter()
    self.publisher.publish(output)
    t3 = perf_counter()
    self.get_logger().info(
        f"parse={(t1-t0)*1e3:.2f}ms compute={(t2-t1)*1e3:.2f}ms "
        f"publish={(t3-t2)*1e3:.2f}ms")
```

## 逐步理解，為什麼這樣改

`perf_counter` 適合量經過時間；相鄰兩個時間點的差，才能定位某段工作。Log 本身也有成本，量正式效能時要降低頻率或記錄到緩衝區。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 不改動輸入輸出
- 不要每筆都大量輸出 log

## 常見錯誤與代價

- 紀錄本身也有 overhead
- 計時位置不等於端到端延遲

**正確性界線：**先測正確性與分布，不根據單次數字做結論。

## 怎麼做測試

固定訊息速率，收集至少多次樣本；看每階段 p50/p95，勿只看單次 Log。

優先觀察：parse ms、compute ms、publish ms。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **callback too slow** 或 **重複解析不變資料** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Python perf_counter](https://docs.python.org/3/library/time.html)
- [ROS 2 Jazzy Executors](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
