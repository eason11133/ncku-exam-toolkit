---
id: lesson-memory-buffer-copy-avoid-extra-copy
title: 避免不必要的重複 Copy
category: Memory Management
tags: memcpy, Buffer 記憶體複製與所有權, 效能優化
aliases: avoid-extra-copy, memory-buffer-copy
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/string/byte/memcpy.html
verified: false
updated_at: 2026-11-12
summary: 如果下一階段可以安全直接讀同一份 buffer，評估傳參考而非再次複製。
related: ncku-c-memory
---

# 避免不必要的重複 Copy

## 先弄懂這個問題

目前的方法是 **Buffer 記憶體複製與所有權**。減少複製可能節省時間與空間，但緩衝區長度、重疊與生命週期要先正確。

這個方案的目的是：少一次大資料複製可能減少記憶體頻寬需求。

你可以先想像這個情境：收到 bytes 後不必要地先轉成 list 再重建 bytes。

## 修改前：先看哪裡有問題

```python
raw = receive_bytes()
values = list(raw)
packet = bytes(values)
consume(packet)
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```python
raw = receive_bytes()
consume(raw)   # 若 consume 只讀資料，不必重新複製
```

## 逐步理解，為什麼這樣改

每多一份資料就增加配置與搬移成本。改成直接傳原始 bytes 的前提是下游不會修改資料，且 API 的所有權及生命週期允許。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 所有權與生命週期明確
- 允許共享只讀資料

## 常見錯誤與代價

- 共享可寫 buffer 會造成競爭
- 可能引入難追蹤的 alias

**正確性界線：**對照輸出 bytes、buffer 寫入時機、RSS 與整體耗時。

## 怎麼做測試

對照 byte-for-byte 結果，並用大/小封包測配置次數、吞吐和記憶體峰值。

優先觀察：bytes copied、總耗時、RSS。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **memcpy slow** 或 **每個階段重複複製整份資料** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [C memcpy](https://en.cppreference.com/w/c/string/byte/memcpy.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
