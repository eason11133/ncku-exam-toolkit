---
id: lesson-transfer-format-compact-binary
title: 評估固定寬度欄位或二進位格式
category: Performance Engineering
tags: serialization, 資料表示／傳輸格式選擇, 效能優化
aliases: compact-binary, transfer-format
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/operator_arithmetic.html
verified: false
updated_at: 2026-11-12
summary: 在雙方都能改動協定的情境，比較 binary 與 text。
related: ncku-binary-packet-parsing
---

# 評估固定寬度欄位或二進位格式

## 先弄懂這個問題

目前的方法是 **資料表示／傳輸格式選擇**。要優化整體系統，除了演算法，也要留意資料格式、序列化與接收處理成本。

這個方案的目的是：二進位可能減少部分字串序列化與解碼，但會增加端序與版本管理。

你可以先想像這個情境：需要發送 16-bit 感測器值，卻每筆用可變長度的文字。

## 修改前：先看哪裡有問題

```python
packet = f"{sensor_id},{reading}".encode("ascii")
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```python
import struct
# 1 byte ID + 2 bytes unsigned value, network byte order
packet = struct.pack(">BH", sensor_id, reading)
# Receiver: sensor_id, reading = struct.unpack(">BH", packet)
```

## 逐步理解，為什麼這樣改

`>BH` 固定使用 big-endian：`B` 佔 1 byte，`H` 佔 2 bytes。讀寫雙方要同意長度、欄位順序、版本、無號範圍；這個例子只有當 `sensor_id` 在 0–255 且 `reading` 在 0–65535 才成立。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 兩端皆可修改
- 有清楚 endian、width、range

## 常見錯誤與代價

- 可能失去可讀性
- 不同版本相容性較難

**正確性界線：**測欄位逐一相同、byte order 和總處理時間。

## 怎麼做測試

測值 0、255、65535 與超界，確認編碼後長度為 3 bytes，往返解碼完全相同。

優先觀察：bytes、encode time、decode time、correctness。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **payload too large** 或 **不必要的大欄位** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [C bitwise operators](https://en.cppreference.com/w/c/language/operator_arithmetic.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
