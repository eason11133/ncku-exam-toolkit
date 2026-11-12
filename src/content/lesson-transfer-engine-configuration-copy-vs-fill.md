---
id: lesson-transfer-engine-configuration-copy-vs-fill
title: 用 increment 旗標區分 Copy / Fill
category: DMA
tags: Transfer Engine, Transfer Engine／DMA 工作描述, 效能優化
aliases: copy-vs-fill, transfer-engine-configuration
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_dma/include/hardware/dma.h
verified: false
updated_at: 2026-11-12
summary: Copy 來源與目的都遞增；Fill 可固定來源並遞增目的。
related: ncku-transfer-engine
---

# 用 increment 旗標區分 Copy / Fill

## 先弄懂這個問題

目前的方法是 **Transfer Engine／DMA 工作描述**。用 channel 描述來源、目的地、count、size、位址遞增，再啟動、等待及釋放。

這個方案的目的是：同一引擎透過不同位址更新策略執行兩種操作。

你可以先想像這個情境：要把一個固定值填滿陣列，卻把來源指標跟目的指標都設為遞增。

## 修改前：先看哪裡有問題

```text
// 概念配置：source_increment=true, dest_increment=true
// 適合逐元素 Copy，不適合固定值 Fill
```

## 修改後：對照實作

```text
// Fill 的概念配置
// source_increment=false : 一直讀同一個值
// dest_increment=true   : 依序寫入目的元素
// count = element_count
```

## 逐步理解，為什麼這樣改

Copy 與 Fill 的差異在來源指標是否前進。這裡沿用官方 Transfer Engine 模擬概念，不宣稱是特定 DMA 控制器可直接使用的設定語法；硬體還需檢查地址、寬度與對齊。

## 什麼情況才適合

- 目的 buffer 可容納 count * size
- 來源具有足夠資料或為一個固定值

## 常見錯誤與代價

- 重疊 buffer 需特別處理
- 不可在搬運尚未完成時釋放或改寫來源

**正確性界線：** 比較目的 bytes 內容及數量。

## 怎麼做測試

分別測每元素都不同的 Copy 與同值 Fill，確認結果與來源位置不變。

優先觀察：正確性、總耗時。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **transfer-engine wrong data** 或 **count 與 bytes 搞混** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Pico SDK DMA Header](https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_dma/include/hardware/dma.h)
