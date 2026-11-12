---
id: lesson-transfer-format-remove-unneeded-data
title: 先刪除明確不需要傳輸的資料
category: Performance Engineering
tags: serialization, 資料表示／傳輸格式選擇, 效能優化
aliases: remove-unneeded-data, transfer-format
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html
verified: false
updated_at: 2026-11-12
summary: 縮小 payload 可降低序列化與搬運成本，但不能刪必要資料。
related: ncku-binary-packet-parsing
---

# 先刪除明確不需要傳輸的資料

## 先弄懂這個問題

目前的方法是 **資料表示／傳輸格式選擇**。要優化整體系統，除了演算法，也要留意資料格式、序列化與接收處理成本。

這個方案的目的是：降低每筆輸出資料量可能影響整條傳輸鏈的瓶頸。

你可以先想像這個情境：Publisher 原本送整張影像，但 Subscriber 其實只用平均亮度。

## 修改前：先看哪裡有問題

```python
payload = {"timestamp": stamp, "pixels": pixels, "average": avg}
publish(payload)
```

## 修改後：對照實作

```python
payload = {"timestamp": stamp, "average": avg}
publish(payload)
```

## 逐步理解，為什麼這樣改

發送前先列出下游真正讀取的欄位，確認沒有其他 Subscriber 需要 `pixels`，再刪除。資料量變小可能降低序列化和傳輸成本，但直接修改既有 ROS message 定義可能破壞相容性，必要時新增 topic/訊息型別。

## 什麼情況才適合

- 接收端確定不需要刪除欄位
- 通訊格式允許改動且雙方同步

## 常見錯誤與代價

- 協定不相容
- 重新編碼本身有成本

**正確性界線：** 比較 payload bytes、接收端正確性及總延遲。

## 怎麼做測試

比對接收端功能、訊息長度、傳輸速率、端到端延遲；確認所有訂閱者的需求。

優先觀察：bytes/message、latency、correctness。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


資料包含下游確定用不到的大欄位，且可在不破壞其他 Subscriber 與訊息相容性的前提下移除時，先減少不必要的 Payload。

## 參考文件與驗證狀態

- [ROS 2 Jazzy Topic CLI](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html)
