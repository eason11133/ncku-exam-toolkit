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

int main(void) {
    char buf[] = "abcdef";
    /* 來源 buf[2..5] 與目的 buf[0..3] 重疊。 */
    memmove(buf, buf + 2, 4);
    buf[4] = '\0';
    if (strcmp(buf, "cdef") != 0) return 1;
    return 0;
}
```

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

## 什麼情況不該用

memmove 支援重疊也不代表可超出來源或目標 Buffer 大小；這仍是記憶體越界。

## 參考與查證狀態

- 參考：[C memory functions](https://en.cppreference.com/w/c/string/byte/memmove)
