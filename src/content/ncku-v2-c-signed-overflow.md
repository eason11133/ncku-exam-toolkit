---
id: ncku-v2-c-signed-overflow
title: C 的 Signed Overflow、Shift 與整數寬度
category: C Programming
tags: overflow, signed, shift, UB, 位元數
aliases: overflow,signed,shift,UB,位元數
source_type: personal
source_url: https://gcc.gnu.org/onlinedocs/gcc/Integers-implementation.html
verified: false
updated_at: 2026-11-12
summary: 程式在 -O0 正常、-O2 結果變掉，先檢查整數溢位與未定義行為。
related: 
priority: P0
difficulty: intermediate
---

# C 的 Signed Overflow、Shift 與整數寬度

## 遇到什麼情況要查這篇

程式在 -O0 正常、-O2 結果變掉，先檢查整數溢位與未定義行為。

## 先理解瓶頸

C 的 signed overflow 是未定義行為；左移 signed 負數、移位量大於等於位元寬度等也容易出錯。編譯最佳化會假設程式沒有未定義行為，因此不能用「我測幾次沒事」證明安全。

## 具體修改／排查示例

```c
#include <stdint.h>
#include <stdbool.h>
#include <limits.h>
// 加法前檢查 uint32_t 範圍
bool add_u32(uint32_t a, uint32_t b, uint32_t *out) {
    if (UINT32_MAX - a < b) return false;
    *out = a + b;
    return true;
}
```

這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。

## 可以嘗試的方案

### 1. 使用固定寬度無號型別

**做法**：明確表達位元運算與模數規則。

**先檢查**：規格本來就是無號語意。

**可能的代價**：不能拿無號混當負數。

**要保留**：邊界值一致。

### 2. 運算前做邊界檢查

**做法**：避免越界和未定義行為。

**先檢查**：溢位有明確處理策略。

**可能的代價**：多一點檢查成本。

**要保留**：不產生錯誤結果。

### 3. 用 sanitizer 與多種優化等級驗證

**做法**：抓編譯器假設下的隱藏問題。

**先檢查**：可以在本機重編譯。

**可能的代價**：sanitizer 本身會變慢。

**要保留**：正式版本不依賴未定義行為。

## 具體驗證流程

在 -O0、-O2 和 UBSan 下使用 INT_MAX、UINT32_MAX、負數與 shift 邊界測試，確認結果相同且沒有 sanitizer 報錯。若規格要求模 2^32，應使用無號型別並明示。

修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。

## 什麼情況不該用

不要以 -fwrapv 作為所有未定義行為的解法，它只處理某些 signed 溢位語意；還有越界、data race、移位等問題。

## 參考與查證狀態

- 參考：[GCC integer overflow](https://gcc.gnu.org/onlinedocs/gcc/Integers-implementation.html)
- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。
- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。
