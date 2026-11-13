---
id: opt-c-wire-format-no-struct
title: 跨平台封包請手動定義 bytes，不要直接傳 struct
category: C Programming
tags: C Programming, c-struct-packing, 考場判讀
aliases: opt-c-wire-format-no-struct, 跨平台封包請手動定義 bytes，不要直接傳 struct
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/language/object
verified: false
updated_at: 2026-11-13
summary: struct 可能有 Padding、不同位元組序及 ABI，不能直接拿 sizeof 傳輸。
related: ncku-v2-c-struct-packing
---

# 跨平台封包請手動定義 bytes，不要直接傳 struct

## 現象

本機 `fwrite(&packet,sizeof packet,1,...)` 看起來成功，另一台機器解出錯誤欄位。`struct` 可能包含 padding，整數還受 endian 與 ABI 影響。網路協定應**定義每個欄位的位寬與 byte 順序**。

<!-- test: full-c -->
```c
#include <stdint.h>
#include <stdio.h>
int main(void) {
    uint16_t id = 0x1234u;
    uint8_t kind = 0x56u;
    uint8_t payload[3] = {
        (uint8_t)(id >> 8), (uint8_t)id, kind
    };
    if (payload[0] != 0x12u || payload[1] != 0x34u ||
        payload[2] != 0x56u) return 1;
    printf("%02X %02X %02X\n", (unsigned)payload[0], (unsigned)payload[1], (unsigned)payload[2]);
    return 0;
}
```

`payload` 恆為 3 bytes 的協定格式（在 `CHAR_BIT==8` 的常見平台上）；不依賴 `sizeof(struct)`。如果題目定義了 checksum、version、長度欄位，這裡只是**三欄示例**，不可拿它代替完整封包。

**驗收**：用固定的 16 進位 golden bytes，比對不同編譯器/不同平台輸出，確認版本與邊界值。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/language/object
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 為什麼 `sizeof(struct)` 不等於封包長度？

看這個 C 宣告：

```c
struct Record {
    uint8_t kind;
    uint32_t id;
    uint16_t count;
};
```

三個欄位本身的寬度相加是 `1+4+2=7` bytes（假設 `CHAR_BIT=8`），但編譯器可能為了對齊把 `id` 前面塞入 padding，最後也加尾端 padding。很多平台會得到 12 bytes，**但你不能把 12 當成 C 語言承諾的固定數字**。`sizeof`、`_Alignof`、`offsetof` 可以在目標編譯器確認實際 layout。

### 直接傳 struct 會踩哪三個坑？

1. Padding 的位置和長度可能依平台／ABI 改變。
2. `uint16_t`、`uint32_t` 在記憶體的 byte order 可能不同。
3. 即使這次碰巧相同，結構定義一改，對面仍用舊格式就會解錯。

因此對外傳輸要先寫清楚：**byte 0 是 kind；byte 1～4 是 big-endian id；byte 5～6 是 big-endian count**。這樣長度固定是 7 bytes，而不是 `sizeof(struct)`。

### 完整程式：把數值編碼成固定的七個 bytes

<!-- v8-extra: full-c -->
```c
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static void encode(uint8_t out[7], uint8_t kind, uint32_t id,
                   uint16_t count) {
    out[0] = kind;
    out[1] = (uint8_t)(id >> 24);
    out[2] = (uint8_t)(id >> 16);
    out[3] = (uint8_t)(id >> 8);
    out[4] = (uint8_t)id;
    out[5] = (uint8_t)(count >> 8);
    out[6] = (uint8_t)count;
}
int main(void) {
    uint8_t p[7] = {0};
    const uint8_t expected[7] = {0x5Au, 0x12u, 0x34u, 0x56u,
                                 0x78u, 0xABu, 0xCDu};
    encode(p, 0x5Au, UINT32_C(0x12345678), UINT16_C(0xABCD));
    if (memcmp(p, expected, sizeof p) != 0) return 1;
    puts("wire-format=7-bytes, expected pattern matched");
    return 0;
}
```

**逐步追蹤：** `id=0x12345678`，右移 24 位只剩 `0x12`，右移 16 位再轉成 `uint8_t` 會保留最低 8 位，也就是 `0x34`。後兩個 byte 一樣處理。這比直接 `memcpy(&id)` 更可控，因為你定義了封包的順序。

**測試：** 除了上面的 Golden Bytes，再試 `id=0`、`UINT32_MAX`、`count=0`、`UINT16_MAX`。若要解碼，就先檢查輸入至少 7 bytes；不能在 `len<7` 時直接讀 `in[6]`。這篇示範的是**固定七位元組格式**，不是自動支援所有協定。
