---
id: opt-c-alignment-safe-byte-parser
title: 不確定對齊時，別把 byte* 直接轉成 uint32_t*
category: C Programming
tags: C Programming, c-struct-packing, 考場判讀
aliases: opt-c-alignment-safe-byte-parser, 不確定對齊時，別把 byte* 直接轉成 uint32_t*
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/language/object
verified: false
updated_at: 2026-11-13
summary: 沒有對齊保證的 buffer 要用安全解碼而不是直接解除參照轉型指標。
related: ncku-v2-c-struct-packing
---

# 不確定對齊時，別把 byte* 直接轉成 uint32_t*

## 為什麼有時候 -O2 才出事

`uint32_t` 通常要求特定對齊，`uint8_t*` 指向的封包起點不一定滿足。`*(const uint32_t*)(buf+1)` 還可能違反有效型別或 strict aliasing，也會受主機 endian 影響。編譯器可能基於語言規則最佳化，所以不要依賴「在這台電腦上可用」。

<!-- test: full-c -->
```c
#include <stdint.h>
#include <stdio.h>
static uint32_t read_be32(const uint8_t *p) {
    return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) |
           ((uint32_t)p[2] << 8) | (uint32_t)p[3];
}
int main(void) {
    const uint8_t b[5] = {0u, 0x12u, 0x34u, 0x56u, 0x78u};
    if (read_be32(b + 1) != UINT32_C(0x12345678)) return 1;
    puts("unaligned offset decoded");
    return 0;
}
```

這個**完整呼叫端**已知 `b+1` 之後有四個 bytes；函式本身沒有長度參數，真正處理外部封包時必須先做 `offset<=len && len-offset>=4` 的邊界檢查。`memcpy` 可以安全複製 object representation，但**不會自動處理 endian**。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/language/object
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 從錯誤資料開始：外部封包不能假設「剛好四個 bytes」

上面的 `read_be32(p)` 是只負責解碼四個 bytes 的函式，假設呼叫者已經確認容量。真正的考題可能要求「讀 offset 開始的 32-bit Big-endian 欄位」，就要先驗證長度。

若 `len=5`、`offset=2`，剩下只有 3 bytes，不能讀 `buf[5]`。也不要先算 `len-offset` 再檢查，因為如果 `offset>len`，`size_t` 的無號減法會下溢。

### 完整、可執行的邊界處理

<!-- v7-test: full-c -->
```c
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <stdio.h>
static bool read_be32(const uint8_t *buf, size_t len,
                      size_t off, uint32_t *out) {
    if (!buf || !out || off > len || len - off < 4) return false;
    const uint8_t *p = buf + off;
    *out = ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) |
           ((uint32_t)p[2] << 8) | (uint32_t)p[3];
    return true;
}
int main(void) {
    const uint8_t b[] = {0xff,0x12,0x34,0x56,0x78};
    uint32_t x=0;
    if (!read_be32(b,5,1,&x) || x!=UINT32_C(0x12345678)) return 1;
    if (read_be32(b,5,2,&x)) return 2;   /* 只有 3 bytes */
    if (read_be32(b,5,6,&x)) return 3;   /* offset 超過 len */
    if (read_be32(NULL,5,1,&x)) return 4;
    if (read_be32(b,5,1,NULL)) return 5;
    printf("decoded=0x%08x\n", (unsigned)x);
    return 0;
}
```

**為什麼用 Shift + OR？** 這樣結果只依賴封包規定的 byte 順序，不依賴主機是 Big-endian 還是 Little-endian，也不需要把不對齊的指標轉成 `uint32_t*`。

**變形題：** 如果要讀的是 Little-endian，就要把第一個 byte 當最低 8 bits；不能只把 `read_be32()` 改個名字。
