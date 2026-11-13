---
id: lesson-transfer-format-compact-binary
title: 評估固定寬度欄位或二進位格式
category: Performance Engineering
tags: serialization, 資料表示／傳輸格式選擇, 效能優化
aliases: compact-binary, transfer-format
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/struct.html
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

## 修改後：對照實作

```python
import struct
# 1 byte ID + 2 bytes unsigned value, network byte order
packet = struct.pack(">BH", sensor_id, reading)
if not (len(packet) == 3):
    raise RuntimeError("example check failed")
if not (struct.unpack(">BH", packet) == (sensor_id, reading)):
    raise RuntimeError("example check failed")
```

## 逐步理解，為什麼這樣改

`>BH` 固定使用 big-endian：`B` 佔 1 byte，`H` 佔 2 bytes。讀寫雙方要同意長度、欄位順序、版本、無號範圍；這個例子只有當 `sensor_id` 在 0–255 且 `reading` 在 0–65535 才成立。

## 什麼情況才適合

- 兩端皆可修改
- 有清楚 endian、width、range

## 常見錯誤與代價

- 可能失去可讀性
- 不同版本相容性較難

**正確性界線：** 測欄位逐一相同、byte order 和總處理時間。

## 怎麼做測試

測值 0、255、65535 與超界，確認編碼後長度為 3 bytes，往返解碼完全相同。

優先觀察：bytes、encode time、decode time、correctness。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷


每筆資料的文字編碼／傳輸體積成為瓶頸，且收發兩端都能升級協定時，評估固定長度二進位欄位；先確認數值範圍、端序與版本。

## 參考文件與驗證狀態

- [Python `struct`：格式字串與位元組順序](https://docs.python.org/3/library/struct.html)
