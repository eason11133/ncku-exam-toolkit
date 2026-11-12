---
id: ncku-v2-c-memcpy-overlap
title: memcpy 與 memmove 的重疊記憶體問題
category: Memory Management
tags: memcpy, memmove, overlap, buffer, 搬移
aliases: memcpy,memmove,overlap,buffer,搬移
source_type: personal
source_url: https://en.cppreference.com/w/c/string/byte/memmove
verified: false
updated_at: 2026-11-12
summary: 移動 Buffer 後資料偶爾壞掉，要確認來源和目的區段是否重疊。
related: 
priority: P0
difficulty: intermediate
---

# memcpy 與 memmove 的重疊記憶體問題

## 遇到什麼情況要查這篇

移動 Buffer 後資料偶爾壞掉，要確認來源和目的區段是否重疊。

## 先理解瓶頸

memcpy 的來源與目的記憶體區段不可以重疊；memmove 則支援重疊搬移。若是 ring buffer 壓縮、陣列刪除頭幾筆，經常是同一陣列內搬移，因此不能無條件選 memcpy。

## 具體修改／排查示例

```c
#include <string.h>
char buf[] = "abcdef";
// 將 buf[2..5] 向左搬兩格：來源與目的重疊
memmove(buf, buf + 2, 4);
buf[4] = '\0';
// buf 現在是 "cdef"
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 重疊區段改用 memmove

**做法**：保持拷貝結果的語意。

**先檢查**：來源與目標區段可能重疊。

**可能的代價**：可能多一點保守處理成本。

**要保留**：每 byte 正確。

### 2. 避免不必要的搬移

**做法**：改索引或 circular buffer。

**先檢查**：操作可用索引表示。

**可能的代價**：結構與邊界管理較複雜。

**要保留**：順序不變。

### 3. 查清長度與容量

**做法**：先確定 memcpy 長度的單位。

**先檢查**：有已知元素大小與上界。

**可能的代價**：需額外邊界檢查。

**要保留**：不越界。

## 具體驗證流程

用相同 Buffer 在向左、向右、完全不重疊的場合做 byte-by-byte 比對。加入 n=0、首尾邊界及容量不足的測試，再比較小/大尺寸下 memcpy/memmove 的性能。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

memmove 支援重疊也不代表可超出來源或目標 Buffer 大小；這仍是記憶體越界。

## 參考與查證狀態

- 參考：[C memory functions](https://en.cppreference.com/w/c/string/byte/memmove)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
