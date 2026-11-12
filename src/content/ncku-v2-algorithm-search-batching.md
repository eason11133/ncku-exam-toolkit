---
id: ncku-v2-algorithm-search-batching
title: 重複查詢、二分與 Hash Index
category: Performance Engineering
tags: dict, set, bisect, binary search, lookup
aliases: dict,set,bisect,binary search,lookup
source_type: personal
source_url: https://docs.python.org/3/library/bisect.html
verified: false
updated_at: 2026-11-12
summary: 同一份資料查很多次時，先建索引通常比每次掃描更划算。
related: 
priority: P0
difficulty: intermediate
---

# 重複查詢、二分與 Hash Index

## 遇到什麼情況要查這篇

同一份資料查很多次時，先建索引通常比每次掃描更划算。

## 先理解瓶頸

查找只發生一兩次時，O(n) 線性掃描可能足夠；若有大量查詢，已排序資料能用 bisect 做 O(log n) 定位，唯一 Key 可用 dict/set 做平均 O(1) 查找。索引建置和維護本身也有成本。

## 具體修改／排查示例

```python
import bisect
xs = sorted([3, 8, 3, 15, 9])
# 是否存在 8；先排序，再二分
idx = bisect.bisect_left(xs, 8)
found = idx < len(xs) and xs[idx] == 8
print(found)
# 如果要按 key 查物件，另建立 dict 更適合
```

## 可以嘗試的方案

### 1. 重複查找改 dict/set

**做法**：以空間換平均查找時間。

**先檢查**：Key 可 hash 且能維護。

**可能的代價**：會多用記憶體。

**要保留**：查找結果相同。

### 2. 排序資料改二分

**做法**：降低大量 read-only 查找成本。

**先檢查**：資料已排序或可一次排序。

**可能的代價**：插入成本可能高。

**要保留**：左右界正確。

### 3. 小規模少查詢維持線性掃描

**做法**：避免多餘索引成本。

**先檢查**：資料量小／只查幾次。

**可能的代價**：N 增加會退化。

**要保留**：無重複鍵錯誤。

## 具體驗證流程

測查詢 1 次、100 次、10000 次；將排序／建 dict 的時間也算進總成本。加入刪除、更新和重複鍵的情境，確認索引不會過期。

## 什麼情況不該用

dict 不是天然有序資料結構，bisect 的插入仍可能需要 O(n) 搬移。不同 key 的重複時需要先選資料結構。

## 參考與查證狀態

- 參考：[Python bisect](https://docs.python.org/3/library/bisect.html)
