---
id: lesson-transfer-engine-configuration-count-unit
title: 先修正 count × size 單位
category: DMA
tags: Transfer Engine, Transfer Engine／DMA 工作描述, 效能優化
aliases: count-unit, transfer-engine-configuration
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_dma/include/hardware/dma.h
verified: false
updated_at: 2026-11-12
summary: count 是「筆數」，size 才是每筆 bytes；兩者乘積是總 bytes。
related: ncku-transfer-engine
---

# 先修正 count × size 單位

## 先弄懂這個問題

目前的方法是 **Transfer Engine／DMA 工作描述**。用 channel 描述來源、目的地、count、size、位址遞增，再啟動、等待及釋放。

這個方案的目的是：若 4096 筆、每筆 4 bytes，總計 16384 bytes。

你可以先想像這個情境：Transfer Engine 設定 count=100，卻把它當成 100 bytes 而不是 100 個元素。

## 修改前：先看哪裡有問題

```c
size_t count = 100;
size_t bytes = count;           // 若每元素 4 bytes，搬不滿
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```c
size_t count = 100;
size_t element_size = sizeof(uint32_t);
if (count > SIZE_MAX / element_size) return ERROR;
size_t bytes = count * element_size;
```

## 逐步理解，為什麼這樣改

先看規格中 `count` 的單位。如果 count 是元素數，總 byte 數才是 `count * element_size`。若 API 已經使用 byte count，就不可再乘一次；乘法前要防整數溢位。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 已確認 buffer 容量
- count * size 不溢位
- 地址和 size 對齊

## 常見錯誤與代價

- count 填成 byte 數可能越界
- 不同 API 計數單位未必一致

**正確性界線：**先用小陣列測正確性，再測大筆數。

## 怎麼做測試

測 0、1、100、容量上限，檢查搬移後每個元素與周圍守衛位元組都正確。

優先觀察：dst 一致性、傳輸 bytes、越界。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **transfer-engine wrong data** 或 **count 與 bytes 搞混** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Pico SDK DMA Header](https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_dma/include/hardware/dma.h)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
