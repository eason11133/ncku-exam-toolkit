---
id: ncku-v2-ros2-service-client-deadlock
title: ROS 2 Service 卡住與 Callback 死鎖
category: ROS 2
tags: service, client, call_async, deadlock, 卡住
aliases: service,client,call_async,deadlock,卡住
source_type: personal
source_url: https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html
verified: false
updated_at: 2026-11-12
summary: Service 有呼叫卻等不到回應，先檢查同步等待與 Callback Group。
related: 
priority: P0
difficulty: intermediate
---

# ROS 2 Service 卡住與 Callback 死鎖

## 遇到什麼情況要查這篇

Service 有呼叫卻等不到回應，先檢查同步等待與 Callback Group。

## 先理解瓶頸

rclpy 的同步 client.call() 可能卡在 callback 裡：回應的完成工作也需要 executor 執行，但目前 callback 正在阻塞。MultiThreadedExecutor 不會自動解決預設同組的互斥限制。先確認是死鎖、服務端不存在，還是正常的高延遲。

## 具體修改／排查示例

```python
# 範例片段：在 timer callback 中發出非阻塞請求
if self.client.service_is_ready() and self.pending is None:
    self.pending = self.client.call_async(request)
    self.pending.add_done_callback(self.on_response)

# on_response 不應再無條件發動下一次 request
# 原本的 self.client.call(request) 可能把 callback 卡住
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 改用 call_async + 完成回呼

**做法**：不在 callback 中同步等 response。

**先檢查**：允許非同步處理與回應回呼。

**可能的代價**：需要追蹤 pending、timeout 與錯誤。

**要保留**：同一請求不得重複操作。

### 2. 分開 Callback Groups

**做法**：讓 Client 與呼叫方具備可排程條件。

**先檢查**：有 MultiThreadedExecutor 且共享狀態安全。

**可能的代價**：程式同步關係更複雜。

**要保留**：必須維持原回覆語意。

### 3. 服務流程拆成狀態機

**做法**：Callback 發出請求即返回，後續由狀態處理結果。

**先檢查**：請求可能跨多個事件且可維護狀態。

**可能的代價**：要管理重試、重入與中斷。

**要保留**：異常情況也能恢復。

## 具體驗證流程

先執行 ros2 service list / ros2 service type，核對名稱與型別；保留一筆正常回應和一筆逾時情境。修改前後計數 callback 進入與完成次數，確認取消／重試不造成重複指令；測單執行緒及多執行緒兩種設定。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

非同步不代表服務端一定有回應；future 的失敗、timeout、重送與資源回收都要處理。把回呼改成 reentrant 前，先檢查共享狀態是否可重入。

## 參考與查證狀態

- 參考：[ROS 2 Jazzy callback groups](https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
