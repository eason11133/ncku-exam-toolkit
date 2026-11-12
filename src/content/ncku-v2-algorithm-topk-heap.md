---
id: ncku-v2-algorithm-topk-heap
title: Top-K、全排序與 Heap 的選擇
category: Performance Engineering
tags: topk, heap, sort, 前K, heapq
aliases: topk,heap,sort,前K,heapq
source_type: personal
source_url: https://docs.python.org/3/library/heapq.html
verified: false
updated_at: 2026-11-12
summary: 只要前 K 名卻排序 N 筆，可能做了太多工作。
related: 
priority: P0
difficulty: intermediate
---

# Top-K、全排序與 Heap 的選擇

## 遇到什麼情況要查這篇

只要前 K 名卻排序 N 筆，可能做了太多工作。

## 先理解瓶頸

如果 N 很大、K 很小，不需要把全部元素排好；Python 可用 heapq.nsmallest / nlargest，或大小為 K 的 Heap 維護候選。但如果 K 接近 N，完整排序可能更快，必須實測。

## 具體修改／排查示例

```python
import heapq
values = [17, 3, 10, 8, 12, 5, 9]
k = 3
print(sorted(values)[:k])       # 完整排序，O(n log n)
print(heapq.nsmallest(k, values)) # 一般實作接近 O(n log k)
# 相同 k=3 結果應為 [3, 5, 8]
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 改用 nsmallest/nlargest

**做法**：只計算需要的前 K。

**先檢查**：K 明顯小於 N。

**可能的代價**：常數因子未必較小。

**要保留**：與基準結果一致。

### 2. 串流中維護固定大小 Heap

**做法**：資料邊到邊維護候選。

**先檢查**：可逐筆處理且只需 K 個。

**可能的代價**：需要處理平手與刪除。

**要保留**：Top K 正確。

### 3. K 很大時保留 sorted

**做法**：避免不必要堆管理。

**先檢查**：需要多數元素的完整順序。

**可能的代價**：完整排序成本較高。

**要保留**：輸出完整。

## 具體驗證流程

測 N=1e3、1e5，K=1、10、N/2、N；包含重複值和帶權的 tie-breaking，驗證排序與選取對同分元素的處理需求。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

K=0 或負數、空輸入、相同分數的穩定排序問題必須提前定義。若後續還需要全排序，先做 Top-K 可能是白忙。

## 參考與查證狀態

- 參考：[Python heapq](https://docs.python.org/3/library/heapq.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
