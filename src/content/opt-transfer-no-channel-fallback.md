---
id: opt-transfer-no-channel-fallback
title: Claim 失敗怎麼辦：保留同步回退與錯誤回報
category: DMA
tags: DMA, transfer-channel-scheduling, 考場排查, 實作條件
aliases: opt-transfer-no-channel-fallback, Claim 失敗怎麼辦：保留同步回退與錯誤回報
difficulty: intermediate
priority: P0
source_type: personal
verified: false
updated_at: 2026-11-13
summary: 通道耗盡時不能以負數 Channel 繼續呼叫；只在語意等價時做 CPU 回退。
related: ncku-v2-transfer-channel-scheduling
---

# `engine_claim()` 回傳 -1，下一步絕對不是 `engine_start(-1)`

當所有 Channel 都被占用，官方 Demo `engine_claim()` 會回傳 -1。題目如果允許等待，應設計有上限的請求 Queue；若允許 CPU 同步複製，必須確認 Copy／Fill 語意、buffer 大小、重疊、資料生命週期。

## 完整 C11：同步 Copy 的安全容量檢查示範

```c
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <stdio.h>

static int copy_fallback(void *dst, size_t dst_size,
                         const void *src, size_t src_size,
                         size_t count, size_t unit) {
    if (!dst || !src || count == 0 || (unit != 1 && unit != 2 && unit != 4) || count > SIZE_MAX / unit) return -1;
    size_t bytes = count * unit;
    if (bytes > dst_size || bytes > src_size) return -1;
    memmove(dst, src, bytes);  /* 允許重疊，也保留原 byte 內容 */
    return 0;
}
int main(void) {
    uint8_t src[] = {1, 2, 3, 4};
    uint8_t dst[4] = {0};
    if (copy_fallback(dst, sizeof dst, src, sizeof src, 4, 1)) return 1;
    if (memcmp(src, dst, 4) != 0) return 2;
    if (copy_fallback(dst, sizeof dst, src, sizeof src, SIZE_MAX, 4) == 0) return 3;
    if (copy_fallback(dst, sizeof dst, src, sizeof src, 0, 1) == 0) return 4;
    if (copy_fallback(dst, sizeof dst, src, sizeof src, 1, 3) == 0) return 5;
    puts("fallback=ok");
    return 0;
}
```

這個 `count>0` 且 `unit` 僅限 1/2/4 的規則是為了**對齊官方 `engine_configure` 的合法參數**，不是說一般 `memmove` API 本身不能接受零長度。這是**同步 Copy** 示範，不會替代 `src_increment=false` 的 Fill，亦不能處理特定硬體寄存器／DMA side effects。真實回退前要確認 `job` 所描述的是連續 Copy 且結果語意允許同步執行。

## 何時不該回退

若目的是讓 CPU 進行其他計算，改成同步 `memmove` 可能讓整體反而更慢；若 Buffer 可能被其他 Thread 在傳輸中改寫，回退也不會神奇修好 data race。沒有足夠容量就回報錯誤，不能為了「讓流程繼續」跳過邊界檢查。

**驗收**：測 count=0、unit=1/2/4、bytes 剛好等於容量、少 1 byte、count*unit 溢位、重疊與不重疊；再比較 CPU 回退和可用 Channel 的整體完成時間。

---

## 深讀：拿不到 Channel，為什麼不能直接用 `memcpy` 取代全部工作？

先看 `job` 的設定，不要看到 `copy` 就以為能換：

| 傳輸設定 | 含義 | 一般 CPU 備援方式 |
|---|---|---|
| `src_increment=true`, `dst_increment=true` | 從連續來源複製到連續目的 | 在範圍正確、允許重疊語意時可評估 `memmove` |
| `src_increment=false`, `dst_increment=true` | 用同一來源值重複填整段目的地 | 要依元素大小執行 Fill，**不是 `memcpy` 一次** |
| `src_increment=true`, `dst_increment=false` | 多筆寫到同一目的位置 | 可能是裝置 FIFO／暫存器寫入，不能當一般陣列複製 |

即使第一列符合，也要核對 `count * size` 是否溢位、來源／目的 Buffer 是否有效，以及業務流程是否允許同步阻塞。若題目本來要求 CPU 在資料搬運期間執行計算，全部換同步 Copy 可能失去重疊的好處。

考場可以先小題測：來源 `[10,20,30]`，Fill 的固定來源是 7，`count=3`、`size=4 bytes`，目的地應是 `[7,7,7]`。如果你只寫 `memcpy(dst,&seven,12)`，不只語意錯，還可能從一個只有 4 bytes 的來源讀出界。

**檢查順序：** Channel 是否真的用完 → 是等待、回退還是報錯 → Job 類型 → 長度／對齊／生命週期 → 輸出結果與錯誤回報。這比「拿不到就直接 memcpy」安全很多。

## 主來源與查證界線

本篇自訂 Transfer Engine API 以使用者提供的成大練習 Demo `demo/section2-3/transfer-engine/engine.h`、`engine.c` 為主來源；`engine.h` 定義公開介面，`engine.c` 顯示 pthread 模擬與通道生命週期。這不是 Pico SDK 的 DMA API，亦未在本輪重新編譯完整 Demo。
