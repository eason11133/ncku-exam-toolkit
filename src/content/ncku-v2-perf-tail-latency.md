---
id: ncku-v2-perf-tail-latency
title: 平均延遲、P95 與負載尖峰
category: Performance Engineering
tags: p95, percentile, tail latency, benchmark
aliases: p95,percentile,tail latency,benchmark
source_type: personal
source_url: https://docs.python.org/3/library/statistics.html
verified: false
updated_at: 2026-11-12
summary: 平均時間變快不代表最慢的那一批也變快，考場要同時看尾端延遲。
related: 
priority: P0
difficulty: intermediate
---

# 平均延遲、P95 與負載尖峰

## 遇到什麼情況要查這篇

平均時間變快不代表最慢的那一批也變快，考場要同時看尾端延遲。

## 先理解瓶頸

平均值容易被少數極快樣本拉低；P95 表示按大小排序後大約 95% 樣本不超過該值。至少同時看平均／中位數／P95／最大值與錯誤率，避免只挑最漂亮的一次。

## 具體修改／排查示例

```python
from statistics import mean, median
samples_ms = [5, 5, 6, 6, 7, 8, 9, 10, 30, 80]
s = sorted(samples_ms)
# nearest-rank P95: ceil(0.95*n) 對應的樣本（1-based）
import math
p95 = s[math.ceil(.95 * len(s)) - 1]
print(mean(s), median(s), p95, max(s))
```

## 可以嘗試的方案

### 1. 加入分位數與最大值

**做法**：避免平均值掩蓋偶發很慢的情況。

**先檢查**：有足量時間樣本。

**可能的代價**：更多統計也要解釋。

**要保留**：時間單位一致。

### 2. 針對 P95 大值追蹤事件

**做法**：把尾端時間和 queue/GC/鎖事件對齊。

**先檢查**：能記下時間戳與工作 ID。

**可能的代價**：增加少量 log 開銷。

**要保留**：找得到可重現原因。

### 3. 維持相同環境做 A/B

**做法**：排除 CPU 負載和暖機干擾。

**先檢查**：測試負載可重播。

**可能的代價**：耗時增加。

**要保留**：可比較性高。

## 具體驗證流程

使用相同樣本數量，先 warm up 再收集；不要只留成功的樣本，錯誤與逾時需另計數。至少重複多輪並記錄負載、環境與程序版本。

## 什麼情況不該用

不同工具的百分位算法可能不同；在小樣本中 P95 極不穩定。不要跨不同運行環境直接比較數字。

## 參考與查證狀態

- 參考：[Python statistics](https://docs.python.org/3/library/statistics.html)
