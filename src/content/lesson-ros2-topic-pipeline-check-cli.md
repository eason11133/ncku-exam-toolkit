---
id: lesson-ros2-topic-pipeline-check-cli
title: 用 ROS 2 CLI 定位傳輸問題
category: ROS 2
tags: ros2 topic, ros2 node info, 效能優化
aliases: check-cli, ros2-topic-pipeline
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html
verified: false
updated_at: 2026-11-12
summary: 先找出資料是在哪一段消失，再修改程式。
related: ncku-ros2-cli-workflow
---

# 用 ROS 2 CLI 定位傳輸問題

## 先弄懂這個問題

目前的方法是 **ROS 2 Topic／Publisher／Subscriber**。訊息從 Publisher 經 Topic 到 Subscriber，Callback 處理後可能再發布；先定位收不到資料的那一段。

這個方案的目的是：用 node info 對照發布／訂閱，再用 topic echo 驗證原始資料與處理結果。

你可以先想像這個情境：ROS 2 Publisher 在跑，但 Subscriber 沒印出任何訊息。

## 修改前：先看哪裡有問題

```bash
# 只一直修改 Python callback，沒有先看 topic 是否存在
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```bash
ros2 node list
ros2 topic list -t
ros2 topic info /sensor -v
ros2 topic echo /sensor
ros2 topic hz /sensor
```

## 逐步理解，為什麼這樣改

先用 CLI 確認 node 名稱、topic 完整路徑、型別、Publisher/Subscriber 數量、QoS 是否相容。`echo` 看資料，`hz` 看頻率；沒有收到可能是名稱或 QoS 問題，不代表 callback 慢。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- ROS 2 Jazzy 環境已啟動
- 知道預期 Topic 名稱與訊息型別

## 常見錯誤與代價

- CLI 只能觀察，還需要進一步定位程式碼
- echo/hz 的輸出也有額外成本

**正確性界線：**保持 Topic 名稱、message type、處理後結果的正確性；除非需求允許，不能藉由跳過訊息改善速度。

## 怎麼做測試

核對實際 topic 名稱與 namespace；調整後測 echo、hz 和自己的 subscriber 都能收到。

優先觀察：通訊成功、資料正確性、延遲。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **ROS 2 找不到資料** 或 **topic 名稱不一致** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [ROS 2 Jazzy Topic CLI](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
