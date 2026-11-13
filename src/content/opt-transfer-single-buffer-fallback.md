---
id: opt-transfer-single-buffer-fallback
title: Double Buffer 出錯時保留安全的單 Buffer 路徑
category: Embedded Systems
tags: Embedded Systems, transfer-double-buffer, 考場判讀
aliases: opt-transfer-single-buffer-fallback, Double Buffer 出錯時保留安全的單 Buffer 路徑
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/string/byte/memcpy
verified: false
updated_at: 2026-11-13
summary: 效能方案沒有驗證完時，先用可對照的同步複製路徑。
related: ncku-v2-transfer-double-buffer
---

# Double Buffer 出錯時保留安全的單 Buffer 路徑

## 什麼時候退回單 Buffer

資源不足、Channel 沒取得、或資料相依性使傳輸與計算不能安全重疊，選同步 Copy 可能比較容易確認正確性。不要把未完成的 DMA 目的 Buffer 交給 CPU 處理，也不要用 `volatile` 旗標假裝是 thread-safe 的完成通知。

## 完整 C11：對照用同步 Copy（不是 DMA）

<!-- test: full-c -->
```c
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
int main(void) {
    const uint32_t src[4]={2,4,6,8};
    uint32_t dst[4]={0};
    size_t count=4;
    if (count > sizeof src/sizeof src[0]) return 1;
    if (count > sizeof dst/sizeof dst[0]) return 2;
    memcpy(dst,src,count*sizeof src[0]);
    if (memcmp(src,dst,sizeof src)!=0) return 3;
    puts("copy verified"); return 0;
}
```

這段只驗證 CPU 的同步記憶體複製，**不能拿它來證明 DMA 的吞吐、CPU 佔用或 Cache 行為**。真實系統如果 DMA 已經啟動但報錯，必須先確認 DMA 停止／取消並回收 Buffer 所有權，才可以安全切換至 CPU Copy。

**驗收**：讓 `Channel claim` 失敗、Buffer 容量不足、來源與目的可能重疊、半途取消與重試；所有情況都能維持原始正確性規則。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/string/byte/memcpy
- 完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
