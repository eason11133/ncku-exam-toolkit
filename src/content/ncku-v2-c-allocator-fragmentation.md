---
id: ncku-v2-c-allocator-fragmentation
title: malloc/realloc 頻繁配置與容量策略
category: Memory Management
tags: malloc, realloc, capacity, allocation, 記憶體
aliases: malloc,realloc,capacity,allocation,記憶體
source_type: personal
source_url: https://en.cppreference.com/w/c/memory/realloc
verified: false
updated_at: 2026-11-12
summary: 大量小物件一直 malloc/free，可能造成配置時間與記憶體碎片。
related: 
priority: P0
difficulty: intermediate
---

# malloc/realloc 頻繁配置與容量策略

## 遇到什麼情況要查這篇

大量小物件一直 malloc/free，可能造成配置時間與記憶體碎片。

## 先理解瓶頸

若每新增一筆資料就 realloc 成恰好多一格，可能造成反覆複製。動態陣列常用擴容策略，例如不足時倍增，讓攤銷每次 append 成本接近 O(1)，但必須守住溢位和 realloc 失敗的處理。

## 具體修改／排查示例

```c
#include <stdlib.h>
#include <stdint.h>
// 簡化片段：使用 size_t cap、len 與 uint32_t *a
if (len == cap) {
    size_t newcap = cap ? cap * 2 : 8;
    if (newcap < cap || newcap > SIZE_MAX / sizeof(*a)) return ERROR;
    void *tmp = realloc(a, newcap * sizeof(*a));
    if (!tmp) return ERROR; // 原指標 a 此時仍有效
    a = tmp; cap = newcap;
}
a[len++] = value;
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 倍增容量避免每次搬移

**做法**：降低 realloc 次數。

**先檢查**：資料可接受預留容量。

**可能的代價**：可能增加峰值記憶體。

**要保留**：元素資料不變。

### 2. 重用短命 Buffer

**做法**：避免每輪重新配置。

**先檢查**：生命周期和佔用可管理。

**可能的代價**：容易留下舊資料。

**要保留**：無 use-after-free。

### 3. 只在量出配置瓶頸後上 Memory Pool

**做法**：集中管理固定尺寸物件。

**先檢查**：大量同尺寸短命物件。

**可能的代價**：需要手動生命週期管理。

**要保留**：無洩漏／越界。

## 具體驗證流程

用固定亂數種子建立相同資料，比較每次 +1 realloc 與倍增容量的時間及峰值容量。測 cap=0、配置失敗、長度溢位；用 ASan 檢查越界與 use-after-free。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

realloc 可能搬到新位置，不能保留舊陣列元素指標；倍增策略也會多佔一些未使用空間。

## 參考與查證狀態

- 參考：[C realloc](https://en.cppreference.com/w/c/memory/realloc)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
