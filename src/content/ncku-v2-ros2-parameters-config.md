---
id: ncku-v2-ros2-parameters-config
title: ROS 2 Parameters 與可重複調校
category: ROS 2
tags: parameter, 參數, batch_size, 參數調整
aliases: parameter,參數,batch_size,參數調整
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html
verified: false
updated_at: 2026-11-12
summary: 需要比較不同參數效能時，不要把硬編碼和測試結果混在一起。
related: 
priority: P1
difficulty: intermediate
---

# ROS 2 Parameters 與可重複調校

## 遇到什麼情況要查這篇

需要比較不同參數效能時，不要把硬編碼和測試結果混在一起。

## 先理解瓶頸

頻率、批次大小、Queue 大小常需要調整。把它們整理成 ROS 2 parameters，記錄每次測試用哪組設定。改參數之前要確認節點是否宣告，以及修改是否會在執行期生效。

## 具體修改／排查示例

```python
# 在 Node 初始化時宣告
self.declare_parameter('batch_size', 16)
n = self.get_parameter('batch_size').value
# CLI：
# ros2 param list /my_node
# ros2 param get /my_node batch_size
# ros2 param set /my_node batch_size 32
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 參數化批次與頻率

**做法**：把調校變成可追蹤設定。

**先檢查**：邏輯可以使用參數。

**可能的代價**：有管理設定的成本。

**要保留**：預設值安全。

### 2. 測試多組參數

**做法**：隔離參數變化的影響。

**先檢查**：有固定基準負載。

**可能的代價**：可能受到背景負載干擾。

**要保留**：正確性不能退化。

### 3. 不在 Callback 反覆取得昂貴設定

**做法**：穩定設定可以快取讀值。

**先檢查**：允許設定非即時同步。

**可能的代價**：動態改參數需通知更新。

**要保留**：不能忽略必要的更新。

## 具體驗證流程

用固定測試資料對照 8、16、32 三種 batch_size，記錄所有設定、程式 commit、每次的延遲及資料正確性。不要只拿最好的一次當結論。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

參數能設成功不代表程式會重新讀取；需測動態修改是否真正生效。參數越多，誤設的風險越大。

## 參考與查證狀態

- 參考：[ROS 2 Jazzy parameters](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
