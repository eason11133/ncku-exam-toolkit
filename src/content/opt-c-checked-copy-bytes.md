---
id: opt-c-checked-copy-bytes
title: memcpy 長度是 byte，不是元素數
category: C Programming
tags: C Programming, c-memcpy-overlap, 考場判讀
aliases: opt-c-checked-copy-bytes, memcpy 長度是 byte，不是元素數
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/string/byte/memcpy
verified: false
updated_at: 2026-11-13
summary: 複製前確認 n×sizeof 的乘法及兩端容量。
related: ncku-v2-c-memcpy-overlap
---

# memcpy 長度是 byte，不是元素數

## 最容易忘記的事情

`memcpy(dst,src,n)` 第三個參數是 **bytes**。要複製 `n` 個 `uint32_t`，通常應寫 `n * sizeof src[0]`。但乘法本身也可能超過 `SIZE_MAX`；即使不溢位，來源與目的仍需各自提供足夠容量。

<!-- test: full-c -->
```c
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
static int bytes_for(size_t count, size_t width, size_t *out) {
    if (!out || width == 0 || count > SIZE_MAX / width) return 0;
    *out = count * width;
    return 1;
}
int main(void) {
    uint32_t src[3] = {7u, 8u, 9u};
    uint32_t dst[3] = {0};
    size_t bytes;
    if (!bytes_for(3, sizeof src[0], &bytes)) return 1;
    if (bytes > sizeof src || bytes > sizeof dst) return 2;
    memcpy(dst, src, bytes); /* 兩個陣列不重疊 */
    if (memcmp(dst, src, bytes) != 0) return 3;
    puts("copy ok");
    return 0;
}
```

## 適用邊界

函式參數 `uint32_t *p` 不是陣列本身，`sizeof p` 只是**指標大小**；若在函式中不知道容量，必須額外傳入元素數或 byte 數。對於可能重疊的記憶體改用 `memmove`，同樣先檢查尺寸。測 `count=0`、最大可容納數、超出容量，以及 `count > SIZE_MAX/width`。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/string/byte/memcpy
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：兩種「大小」要分開算

想像有三筆 `uint32_t`，內容是 7、8、9。你想搬三筆，`memcpy` 卻要求你填**位元組數**。在常見的 `sizeof(uint32_t)==4` 平台，搬三筆就是 12 bytes。若誤寫 `memcpy(dst,src,3)`，只搬了前三個 bytes；整數結果可能錯，卻未必發生越界，因此 ASan 不一定會提醒。

把問題拆成兩關：第一關 `count * sizeof(T)` 能不能安全算出來；第二關來源、目的的容量有沒有**各自**至少這麼多 bytes。第一關要先用 `count > SIZE_MAX / sizeof(T)` 擋下乘法溢位；第二關不能用 `sizeof(ptr)` 當外部陣列容量，因為在函式參數內 `ptr` 只是指標。

| 條件 | 你該怎麼判斷 |
|---|---|
| `count=0` | 不需要搬任何 bytes；仍應用 API 合約處理指標有效性，不要靠測試一次沒出事就假設任何空指標都安全 |
| `count=3`，兩端各只有 8 bytes | 算得出 12 bytes，但**容量不足**，必須拒絕 |
| 兩區間有重疊 | 即使大小足夠，也不能用 `memcpy`；要檢查後用 `memmove` |
| 把 `uint32_t*` 傳進函式 | 必須另外傳 `capacity`，函式無法從指標反推陣列長度 |

**動手驗收：** 先把完整範例中的來源改成 `{1,2,3}`，確認三筆都相等；再把目的容量改小，程式必須先拒絕，而不是讓 Sanitizer 幫你事後抓錯。這兩種測試在驗證不同問題。
