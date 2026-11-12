---
id: ncku-v2-c-io-buffering
title: C 標準輸入輸出與過度 Logging
category: C Programming
tags: printf, logging, setvbuf, stdout, io
aliases: printf,logging,setvbuf,stdout,io
source_type: personal
source_url: https://en.cppreference.com/w/c/io/setvbuf
verified: false
updated_at: 2026-11-12
summary: 每筆工作都 printf，程式可能主要花時間在輸出或格式化。
related: 
priority: P0
difficulty: intermediate
---

# C 標準輸入輸出與過度 Logging

## 遇到什麼情況要查這篇

每筆工作都 printf，程式可能主要花時間在輸出或格式化。

## 先理解瓶頸

大量小筆 printf 可能成為可見瓶頸，尤其是 flush 頻繁或終端機慢。先用不輸出／少輸出兩種模式比較，再決定保留必要錯誤日誌和統計而不是全部關閉。

## 具體修改／排查示例

```c
#include <stdio.h>
// 在正常 I/O 發生前選擇適當 buffering；用途依 stdout/stderr 而定
char output_buffer[8192];
setvbuf(stdout, output_buffer, _IOFBF, sizeof output_buffer);
// buffer 必須活到 stdout 結束使用；不能用短命區域陣列
```

## 可以嘗試的方案

### 1. 降低熱路徑內的 Logging

**做法**：將逐筆輸出改成統計輸出。

**先檢查**：允許犧牲細節量。

**可能的代價**：除錯資訊可能不足。

**要保留**：仍能定位錯誤。

### 2. 使用適當 Buffering

**做法**：降低寫入系統呼叫次數。

**先檢查**：可容忍一定輸出延遲。

**可能的代價**：崩潰前未 flush 可能遺失。

**要保留**：最後輸出完整。

### 3. 拆分 Debug 與正式執行模式

**做法**：避免測試被 log 影響。

**先檢查**：能固定執行設定。

**可能的代價**：模式差異需記錄。

**要保留**：兩種模式結果一致。

## 具體驗證流程

同一筆工作分別測全量逐筆 log、每 1000 筆彙總、完全停 log；確認最終輸出／錯誤紀錄仍可重現。量吞吐和耗時，並在 redirection 與 terminal 測差異。

## 什麼情況不該用

stderr 通常不同緩衝策略；即時控制／安全事件不可因緩衝而失去必要的立即回報。

## 參考與查證狀態

- 參考：[C stdio buffering](https://en.cppreference.com/w/c/io/setvbuf)
