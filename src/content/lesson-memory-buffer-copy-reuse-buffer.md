---
id: lesson-memory-buffer-copy-reuse-buffer
title: 重用固定大小 Buffer
category: Memory Management
tags: memcpy, Buffer 記憶體複製與所有權, 效能優化
aliases: reuse-buffer, memory-buffer-copy
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/string/byte/memcpy.html
verified: false
updated_at: 2026-11-12
summary: 高頻分配／釋放造成額外成本時可重用記憶體。
related: ncku-c-memory
---

# 重用固定大小 Buffer

## 先弄懂這個問題

目前的方法是 **Buffer 記憶體複製與所有權**。減少複製可能節省時間與空間，但緩衝區長度、重疊與生命週期要先正確。

這個方案的目的是：減少 malloc/free 呼叫與記憶體碎片。

你可以先想像這個情境：每收到一包就配置固定大小暫存空間。

## 修改前：先看哪裡有問題

```c
for (size_t i = 0; i < packet_count; ++i) {
    uint8_t *tmp = malloc(4096);
    if (!tmp) break;
    process_packet(tmp, 4096);
    free(tmp);
}
```

## 修改後：對照實作

```c
uint8_t *tmp = malloc(4096);
if (!tmp) return ERROR;
for (size_t i = 0; i < packet_count; ++i) {
    process_packet(tmp, 4096);
}
free(tmp);
```

## 逐步理解，為什麼這樣改

反覆使用可減少 malloc/free；但如果 `process_packet` 會保留指標、另一個 thread 還在讀、或每包需要不同容量，就不能立即覆寫。重用前也要確定是否需要初始化。

## 什麼情況才適合

- 明確初始化和可寫範圍
- 同時使用者有同步規則

## 常見錯誤與代價

- 占住高峰容量記憶體
- 可能意外保留舊資料

**正確性界線：** 每次使用前正確初始化，測峰值 RSS 和分配耗時。

## 怎麼做測試

用 ASan/Valgrind 檢查生命週期和越界；觀察配置次數、執行時間及峰值 RAM。

優先觀察：allocation count、RSS、耗時。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


反覆配置／釋放固定大小的暫存 Buffer，且能保證初始化、所有權與重用時機時，評估一次配置後循環重用。

## 參考文件與驗證狀態

- [C memcpy](https://en.cppreference.com/w/c/string/byte/memcpy.html)
