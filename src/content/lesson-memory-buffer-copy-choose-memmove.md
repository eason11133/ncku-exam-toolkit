---
id: lesson-memory-buffer-copy-choose-memmove
title: 重疊區域改用 memmove
category: Memory Management
tags: memcpy, Buffer 記憶體複製與所有權, 效能優化
aliases: choose-memmove, memory-buffer-copy
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/string/byte/memcpy.html
verified: false
updated_at: 2026-11-12
summary: 如果來源與目的範圍重疊，不能直接使用 memcpy。
related: ncku-c-memory
---

# 重疊區域改用 memmove

## 先弄懂這個問題

目前的方法是 **Buffer 記憶體複製與所有權**。減少複製可能節省時間與空間，但緩衝區長度、重疊與生命週期要先正確。

這個方案的目的是：memmove 將資料按安全順序移動，避免重疊造成未定義行為。

你可以先想像這個情境：在同一陣列內把元素往後移動，來源與目標重疊。

## 修改前：先看哪裡有問題

```c
// buf 是 char[16]，有效資料至少 8 bytes
memcpy(buf + 2, buf, 8); // 重疊時未定義行為
```

## 修改後：對照實作

```c
// 先確認目標範圍 2..9 在容量內
memmove(buf + 2, buf, 8); // 可處理來源與目標重疊
```

## 逐步理解，為什麼這樣改

`memcpy` 要求來源與目標不重疊；`memmove` 定義了重疊搬移的語意。它不幫你擴充容量，也不保證長度正確；仍要檢查 `2+8 <= sizeof buf`。

## 什麼情況才適合

- 已證實 ranges overlap
- buffer 尺寸正確

## 常見錯誤與代價

- 有可能比 memcpy 多成本
- 不是效能優化優先選擇，而是正確性修正

**正確性界線：** 測重疊前移與後移的內容相同。

## 怎麼做測試

測前移、後移、不重疊、零長度及容量邊界；用 AddressSanitizer 查越界。

優先觀察：正確性、總耗時。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


來源與目的在同一 buffer 中可能重疊，或搬移後資料損毀時，先查範圍、容量，再用 memmove。memcpy 慢本身不是改用 memmove 的理由。

## 參考文件與驗證狀態

- [C memcpy](https://en.cppreference.com/w/c/string/byte/memcpy.html)
- [C memmove](https://en.cppreference.com/w/c/string/byte/memmove.html)
