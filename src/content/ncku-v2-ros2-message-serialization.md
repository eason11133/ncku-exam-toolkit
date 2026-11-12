---
id: ncku-v2-ros2-message-serialization
title: ROS 2 訊息資料量與序列化成本
category: ROS 2
tags: serialization, encode, decode, copy, 大量資料
aliases: serialization,encode,decode,copy,大量資料
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Basic/About-Topics.html
verified: false
updated_at: 2026-11-12
summary: Topic 頻率不高仍佔 CPU，先檢查每筆訊息尺寸、複製次數及編解碼。
related: 
priority: P1
difficulty: intermediate
---

# ROS 2 訊息資料量與序列化成本

## 遇到什麼情況要查這篇

Topic 頻率不高仍佔 CPU，先檢查每筆訊息尺寸、複製次數及編解碼。

## 先理解瓶頸

一張圖片或大型陣列在 Python 裡先轉 list、再轉 bytes、再包成 message，可能比真正運算還耗時。應先量完整發布路徑各段耗時和每秒傳輸量；減少欄位或改資料表示法前，先核對下游是否依賴原格式。

## 具體修改／排查示例

```python
from time import perf_counter
# 先量測每個階段，不預設某種訊息型別可以直接接受 bytes
t0 = perf_counter()
payload = encode_frame(raw_buffer)
t1 = perf_counter()
msg.data = payload  # payload 類型須符合實際 ROS message 欄位
t2 = perf_counter()
publisher.publish(msg)
t3 = perf_counter()
print('encode/assign/publish:', t1-t0, t2-t1, t3-t2)
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 減少不必要的資料轉換

**做法**：移除 list/bytes 等重複建立。

**先檢查**：訊息型別允許直接指派相容型別。

**可能的代價**：需要查 ROS 2 API 與資料生命週期。

**要保留**：資料逐 byte 一致。

### 2. 減少不必要欄位或發送頻率

**做法**：降低每秒移動資料量。

**先檢查**：下游不依賴被移除內容。

**可能的代價**：介面相容性需重新測。

**要保留**：不能破壞必要欄位。

### 3. 大型資料另設適合的傳輸路徑

**做法**：用分塊或外部共享通道減少單次負擔。

**先檢查**：環境允許架構修改。

**可能的代價**：複雜度與同步成本高。

**要保留**：必須驗證每筆資料完整。

## 具體驗證流程

在輸入完全相同、訊息數量與大小固定時，量資料準備、建立 message、publish 與接收端解碼的時間。核對發送端和接收端 checksum，記錄每秒傳輸 bytes。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

不要把「減少 Python 轉換」誤當成真正 middleware zero-copy。壓縮會增加 CPU；大 payload 可能影響 QoS 和記憶體。

## 參考與查證狀態

- 參考：[ROS 2 Jazzy topics](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Topics.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
