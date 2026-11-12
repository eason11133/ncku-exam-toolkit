---
id: lesson-transfer-engine-configuration-count-unit
title: 先修正 count × size 單位
category: DMA
tags: Transfer Engine, Transfer Engine／DMA 工作描述, 效能優化
aliases: count-unit, transfer-engine-configuration
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_dma
verified: false
updated_at: 2026-11-12
summary: count 是「筆數」，size 才是每筆 bytes；兩者乘積是總 bytes。
related: ncku-transfer-engine
---

# 先修正 count × size 單位

## 先看 Demo 的工作描述

Demo 使用的 `engine_job_t` 有 `src`、`dst`、`count`、`size`、`src_increment`、`dst_increment` 等欄位。**`job.count` 是傳輸筆數；`job.size` 表示每筆大小**（例如 `XFER_32` 對應每筆 4 bytes）。因此真正要改的是描述工作時填入的 `job.count` 或 `job.size`，不是另算一個 `bytes` 後卻不改 job。若 `count = 4096`、`size = XFER_32`，來源與目的地各至少要有 `4096 × 4 = 16384` bytes。這個 Demo 的軟體 Transfer Engine 與 Pico SDK 硬體 DMA 是不同 API，不能把兩者的欄位或速度混為一談。

### 錯誤與修正的欄位

```c
// engine_job_t 的欄位設定片段；須放在 Demo 已宣告 job、src、dst 的函式內。
job.src = src;
job.dst = dst;
job.count = 4096 * 4;  // 錯：把總 bytes 當作 32-bit 傳輸筆數
job.size = XFER_32;    // 每筆 4 bytes；上行將要求搬運 65536 bytes

job.count = 4096;      // 對：4096 筆，而非 16384 bytes
job.size = XFER_32;    // 每筆 4 bytes，總計 16384 bytes
```

### 容量及溢位檢查

以下仍是 **Demo 程式的函式內片段**；`engine_job_t`、`XFER_32`、`job`、`src`、`dst` 及 buffer 容量需由該 Demo 的 header 與呼叫端提供。這裡不冒充已驗證的獨立編譯範例。

```c
#include <stdint.h>
#include <stddef.h>

size_t count = 4096;
size_t bytes_per_transfer = sizeof(uint32_t); // 對應 XFER_32
if (count > SIZE_MAX / bytes_per_transfer) {
    /* 回報整數溢位，不得啟動傳輸 */
    return ERROR;
}
size_t total_bytes = count * bytes_per_transfer;
if (src_capacity_bytes < total_bytes || dst_capacity_bytes < total_bytes) {
    /* 回報來源或目的地空間不足 */
    return ERROR;
}
/* 也要確認 count 能放進 Demo 中 job.count 的型別。 */
job.src = src;
job.dst = dst;
job.count = count;
job.size = XFER_32;
job.src_increment = true;
job.dst_increment = true;
```

`SIZE_MAX` 檢查必須在乘法前做；乘完還要對照 **來源和目的地各自的實際容量**，再確認位址對齊與 `job.count` 型別範圍。若原本的程式是 Pico SDK 的 `dma_channel_configure()`，應改查該 API 的 transfer count 規則，不能直接套用 `engine_job_t` 欄位名稱。

## 什麼情況才適合

- 已確認 buffer 容量
- count * size 不溢位
- 地址和 size 對齊

## 常見錯誤與代價

- count 填成 byte 數可能越界
- 不同 API 計數單位未必一致

**正確性界線：** 先用小陣列測正確性，再測大筆數。

## 怎麼做測試

測 0、1、100、容量上限，檢查搬移後每個元素與周圍守衛位元組都正確。

優先觀察：dst 一致性、傳輸 bytes、越界。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **transfer-engine wrong data** 或 **count 與 bytes 搞混** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Pico SDK DMA transfer count：以筆數計，不是 bytes](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_dma)
- `engine_job_t` 欄位名稱依隨教材提供的 Demo 敘述；本專案未附 `engine.h` 原始碼，無法核對該 Demo 的完整型別與編譯結果，片段需回到 Demo 原始碼確認。
