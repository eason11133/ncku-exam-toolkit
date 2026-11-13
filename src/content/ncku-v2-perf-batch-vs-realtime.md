---
id: ncku-v2-perf-batch-vs-realtime
title: Batch Size、吞吐量與即時延遲取捨
category: Performance Engineering
tags: batch, throughput, latency, flush, 批次
aliases: batch,throughput,latency,flush,批次
source_type: personal
source_url: https://www.man7.org/linux/man-pages/man1/perf-stat.1.html
verified: false
updated_at: 2026-11-12
summary: Batch 越大不一定越好，要考慮等待湊批次的時間。
related: 
priority: P0
difficulty: intermediate
---

# Batch Size、吞吐量與即時延遲取捨

## 遇到什麼情況要查這篇

Batch 越大不一定越好，要考慮等待湊批次的時間。

## 先理解瓶頸

一筆一筆處理會多付每次呼叫成本；合批能攤低固定成本，但最早進來的資料可能得等待整批到齊。依需求選固定批次大小或到期先 flush，分別量吞吐與訊息延遲。

## 具體修改／排查示例

```python
# 偽碼：既限制批次數，也有最大等待時間
batch.append(item)
if len(batch) >= MAX_BATCH or age_of_oldest(batch) >= MAX_WAIT:
    process_batch(batch)
    batch.clear()
# 定時 flush 需要真的有 timer；只有新 item 進來才檢查會卡住
```

## 可以嘗試的方案

### 1. 固定批次改善吞吐

**做法**：攤平每筆 setup 成本。

**先檢查**：可接受合批延遲。

**可能的代價**：前面資料需等待。

**要保留**：不漏不重。

### 2. 加最大等待期限

**做法**：稀疏流量時也能完成。

**先檢查**：有定時器／flush 機制。

**可能的代價**：timer 本身有成本。

**要保留**：最後一批不留在 queue。

### 3. 自適應批次但保守上限

**做法**：高低負載時調整大小。

**先檢查**：能量測並設定邊界。

**可能的代價**：邏輯更複雜。

**要保留**：輸出正確性不變。

## 具體驗證流程

量 batch=1、4、16、64 的 throughput、P50/P95 latency、最大 buffer 記憶體，資料量要一致；最後加一筆稀疏輸入測「一直湊不滿」的情況。

## 什麼情況不該用

大小與等待時間都設太大，可能讓即時結果延後；Batch 不應破壞事件順序或不可拆分的工作單位。

## 參考與查證狀態

- 參考：[Linux perf tools](https://www.man7.org/linux/man-pages/man1/perf-stat.1.html)
