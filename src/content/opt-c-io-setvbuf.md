---
id: opt-c-io-setvbuf
title: C 的 setvbuf：什麼時候真的該調緩衝
category: C Programming
tags: C Programming, c-io-buffering, 考場判讀
aliases: opt-c-io-setvbuf, C 的 setvbuf：什麼時候真的該調緩衝
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/io/setvbuf
verified: false
updated_at: 2026-11-13
summary: 先辨別小量多次 I/O，才能安全更改 buffering。
related: ncku-v2-c-io-buffering
---

# C 的 setvbuf：什麼時候真的該調緩衝

## 誤判的來源

大量小筆 `fputc`、`fprintf` 可能受 I/O syscall 與同步成本影響，但 C 標準函式庫通常已經提供 buffering。改成大 buffer **不保證**更快；互動式協定如果要立即輸出，緩衝反而可能讓另一端一直等。

## 完整 C11 範例

<!-- test: full-c -->
```c
#include <stdio.h>
int main(void) {
    if (setvbuf(stdout, NULL, _IOFBF, 32768) != 0) return 1;
    for (int i = 0; i < 10; ++i)
        if (printf("%d\n", i) < 0) return 2;
    if (fflush(stdout) == EOF) return 3;
    return 0;
}
```

`setvbuf` 必須在這個 stream 的第一次一般 I/O **之前**呼叫。範例讓 C library 自己管理 buffer，沒有把已失效的區域交給它；最後用 `fflush` 檢查輸出錯誤。

## 注意事項與測試

- 有即時互動要求時不能任意改成 Full Buffer；TTY、pipe、檔案的預設行為不同。
- 自訂 `char buf[]` 若生命週期短於 stream，會有未定義行為；通常先用 `NULL`。
- 用同一份輸入測三種設定：預設、Full Buffer、Unbuffered；比對 **byte-for-byte 輸出**和時間，避免忽略 `fflush` 成本。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/io/setvbuf
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 深讀延伸｜把原理放進真實情境
## `setvbuf` 是調整 I/O 策略，不是通用加速按鈕

你在迴圈呼叫一萬次 `printf`，輸出可能成為瓶頸；但先分清「資料寫入了 C 的使用者空間緩衝區」和「真正送到終端機／檔案」兩件事。較大的 buffer 可能減少底層寫入呼叫，卻也可能讓你在程式還沒結束時看不到即時輸出。**用來判斷的 Debug 訊息**若被延後，排錯反而更難。

`setvbuf(stream, buffer, mode, size)` 應在該串流**做其他 I/O 前**設定。若傳入自備的 buffer，該 buffer 必須在串流使用期間保持有效；不能指向已離開作用域的陣列。想降低風險時，可以先考慮傳 `NULL`，由實作管理緩衝區；也別把 `stdout` 的設定誤認成會同時改變 `stderr`。

例如輸出 100 行到檔案，測試應比較最終檔案內容逐 byte 相同、退出碼相同，並量**整個程序完成時間**；不要只量迴圈前後的幾行 `printf`，卻把 `fflush` 或程式結束時的 flush 排除在外。

**變形題：** 如果目的是每來一筆訊息就立刻讓另一個程序看見，改用全緩衝可能破壞需求。這種情況優先顧正確送達與 flush 時機，而不是只追求 throughput。
