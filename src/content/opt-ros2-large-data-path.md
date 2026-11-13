---
id: opt-ros2-large-data-path
title: 大訊息要不要改共享記憶體或 Zero-Copy？
category: ROS 2
tags: ROS 2, ros2-message-serialization, 考場判讀
aliases: opt-ros2-large-data-path, 大訊息要不要改共享記憶體或 Zero-Copy？
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/How-To-Guides/Configure-ZeroCopy-loaned-messages.html
verified: false
updated_at: 2026-11-13
summary: Loaned Message 是否真的 zero-copy 取決於語言、RMW 與部署方式。
related: ncku-v2-ros2-message-serialization
---

# 大訊息要不要改共享記憶體或 Zero-Copy？

## 不要看到「Zero Copy」就直接套用

ROS 2 在不同 Process／不同機器之間通信，可能經過 DDS/RMW 及序列化。Jazzy 有 Loaned Message／Intra-process 的相關機制，但**使用 API 不代表一定在目標環境做到零拷貝**；實際支援與訊息型別、底層 RMW、C++/Python 路徑有關。官方示例多以 rclcpp 說明，不能默認 Python rclpy 的 Demo 具備相同模式。

## 評估步驟

1. 先量出 message 大小、序列化成本、callback CPU 與端到端延遲。
2. 確認 Node 是否同一個 Process；如果不是，是否有支援的共享記憶體 RMW。
3. 查看官方 Jazzy 說明與當前 middleware 的實際 loaning 支援；沒有支援就不要改成強制路徑。
4. 小步替換後比對 checksum、接收筆數、順序、錯誤率與記憶體生命週期。

```text
Benchmark A: existing Publisher -> DDS -> Subscriber
Benchmark B: supported intra-process/loaned configuration
Compare: payload bytes, correct messages, dropped count, latency distribution
```

此處是**效能研究流程，不含能在考場直接執行的零拷貝程式**。如果考試只給 Python `publisher.py`／`processor.py`，通常先修 callback 本身的多餘工作，比大幅重寫 middleware 更可控。

## 來源與驗證界線

- 參考：https://docs.ros.org/en/jazzy/How-To-Guides/Configure-ZeroCopy-loaned-messages.html
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。

## 延伸推演｜遇到變形題怎麼判斷

## Zero-Copy 聽起來很快，但你先要知道少複製了哪一段

假設一張影像從攝影機送到 Publisher，經過 ROS 2 到 Subscriber，最後交給演算法。沿途可能有資料格式轉換、序列化、DDS 傳輸和記憶體複製。你不能因為用到某個號稱 Zero-Copy 的 API，就宣稱整條路徑完全沒有拷貝；要逐段核對目標 RMW、Message Type、部署方式與 API 支援。

若 Consumer 只需要平均亮度，還可以評估在來源端先算完、改傳結果，但前提是其他 Subscriber 不需要原始影像。這會改變介面，不可只為省時間忽略。

量測時要保持相同影像尺寸、頻率與工作內容，記錄總延遲、CPU Time、峰值記憶體以及輸出是否逐項一致。若新版只送縮小影像、舊版送原始影像，兩者不是只比較通訊技術的公平 A/B。
