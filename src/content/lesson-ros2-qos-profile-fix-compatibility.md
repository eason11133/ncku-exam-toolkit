---
id: lesson-ros2-qos-profile-fix-compatibility
title: 先解決 QoS 不相容
category: ROS 2
tags: QoS, ROS 2 QoS／History／Reliability, 效能優化
aliases: fix-compatibility, ros2-qos-profile
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-12
summary: 確認 Reliable、Best Effort、Durability 的 request/offer。
related: ncku-ros2-qos
---

# 先解決 QoS 不相容

## 先弄懂這個問題

目前的方法是 **ROS 2 QoS／History／Reliability**。ROS 2 的訊息傳遞條件，影響能否連線、是否重傳、保留多少資料。

這個方案的目的是：ROS 2 的 QoS 端點設定必須可相容，Topic 名稱正確並不保證能傳輸。

你可以先想像這個情境：Publisher 與 Subscriber topic 名稱相同，卻完全收不到訊息。

## 修改前：先看哪裡有問題

```bash
ros2 topic list -t
# 只看 topic 名稱，沒檢查 QoS
```

## 修改後：對照實作

```bash
ros2 topic info /sensor -v
# 檢查 offered / requested QoS：Reliability、Durability 等
# 再依用途調整雙方 QoS，確認相容
```

## 逐步理解，為什麼這樣改

ROS 2 QoS 可能造成端點不配對。先確認型別和 topic 完整名稱，再看 offered/requested QoS；不能把「改成 Reliable」當萬用解法，因為需求與提供之間有相容性規則。

## 什麼情況才適合

- 可讀到兩端的 QoS 設定
- 了解資料是否允許遺失

## 常見錯誤與代價

- 修改可靠性需求可能犧牲正確性
- 不同 RMW 的效能也可能不同

**正確性界線：** 修改前先說清可接受的遺失與重送需求。

## 怎麼做測試

改設定後使用 echo、hz 與 subscriber 端實測訊息是否送達，並查需求下的正確性。

優先觀察：成功接收率、丟訊息率、延遲。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **QoS mismatch** 或 **Publisher 與 Subscriber QoS 不相容** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [ROS 2 Jazzy QoS](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
