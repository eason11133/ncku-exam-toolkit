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

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

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

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 明確初始化和可寫範圍
- 同時使用者有同步規則

## 常見錯誤與代價

- 占住高峰容量記憶體
- 可能意外保留舊資料

**正確性界線：**每次使用前正確初始化，測峰值 RSS 和分配耗時。

## 怎麼做測試

用 ASan/Valgrind 檢查生命週期和越界；觀察配置次數、執行時間及峰值 RAM。

優先觀察：allocation count、RSS、耗時。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **memcpy slow** 或 **每個階段重複複製整份資料** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [C memcpy](https://en.cppreference.com/w/c/string/byte/memcpy.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
