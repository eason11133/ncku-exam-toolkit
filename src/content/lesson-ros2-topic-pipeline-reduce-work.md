---
id: lesson-ros2-topic-pipeline-reduce-work
title: 減少 Subscriber Callback 內的多餘工作
category: ROS 2
tags: ros2 topic, ROS 2 Topic／Publisher／Subscriber, 效能優化
aliases: reduce-work, ros2-topic-pipeline
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html
verified: false
updated_at: 2026-11-12
summary: 找到重複解析、同步 I/O 或昂貴計算，先量測後縮短。
related: ncku-ros2-cli-workflow
---

# 減少 Subscriber Callback 內的多餘工作

## 先弄懂這個問題

目前的方法是 **ROS 2 Topic／Publisher／Subscriber**。訊息從 Publisher 經 Topic 到 Subscriber，Callback 處理後可能再發布；先定位收不到資料的那一段。

這個方案的目的是：Callback 在忙時可能接收排隊，縮短工作量能增加可處理的頻率。

你可以先想像這個情境：一筆感測器資料進來後，Subscriber 每次都做不變的初始化。

## 修改前：先看哪裡有問題

```python
def cb(self, msg):
    cfg = json.loads(self.fixed_config_json)
    out = compute(msg, cfg)
    self.pub.publish(out)
```

## 修改後：對照實作

```python
# 在 __init__ 建立一次
self.cfg = json.loads(self.fixed_config_json)

def cb(self, msg):
    out = compute(msg, self.cfg)
    self.pub.publish(out)
```

## 逐步理解，為什麼這樣改

減少同一個 executor 中 callback 的占用，有機會改善其他工作等待；但設定可更新時要配套失效機制，不能因此送錯資料。

## 什麼情況才適合

- 已量測到 Callback 自身耗時
- 不改變訊息格式與輸出規則

## 常見錯誤與代價

- 重複工作若改成快取，要處理更新與失效
- 過度省略可能丟必要驗證

**正確性界線：** 輸入輸出資料值、順序、數量必須符合原規格。

## 怎麼做測試

對相同訊息測新舊輸出完全一致，並測設定更新；比較 callback duration/p95。

優先觀察：callback 耗時、輸出筆數、CPU。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


Topic 已通、Callback 內有不必要的重算或設定解析，導致延遲偏高時，先把不變工作移出 Callback；Topic 名稱錯誤應先走 CLI 排查。

## 參考文件與驗證狀態

- [ROS 2 Jazzy Topic CLI](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html)
- [ROS 2 Jazzy Executors](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html)
