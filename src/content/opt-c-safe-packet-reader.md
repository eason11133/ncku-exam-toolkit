---
id: opt-c-safe-packet-reader
title: C 封包解析：先檢查長度，再安全讀取 Big-endian 整數
category: C Programming
tags: uint8_t,uint32_t,endian,packet,bounds,shift
aliases: parse u32 be,byte order,封包長度,buffer 越界,shift OR
source_type: personal
source_url: https://en.cppreference.com/w/c/language/operator_arithmetic.html
verified: false
updated_at: 2026-11-13
summary: 用完整 C11 程式示範截斷封包、offset 與 uint32_t 指標安全檢查。
related: opt-c-safe-bit-fields,ops-debug-c
priority: P0
difficulty: intermediate
---

# `buf[0]` 到 `buf[3]` 不能直接讀

已知封包格式是 Big-endian 的 32-bit 無號整數，才可以把四個 bytes 組成 `uint32_t`。例如 `12 34 56 78` 應得到 `0x12345678`。`uint32_t` 先轉型再左移，是為了避免在較窄或有號的中間運算裡出現錯誤。

真正容易出包的地方是**長度判斷**。不能寫 `len - offset < 4` 然後就認定安全：如果 `offset > len`，兩個 `size_t` 相減會無號下溢。因此先檢查 `offset <= len`，再檢查剩餘長度。讀取失敗時不要改動呼叫者傳入的輸出值。

## 完整可編譯的 C11 程式

```c
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

static bool read_u32_be(const uint8_t *buf, size_t len,
                        size_t offset, uint32_t *out) {
    if (buf == NULL || out == NULL) return false;
    if (offset > len || len - offset < 4u) return false;
    *out = ((uint32_t)buf[offset] << 24) |
           ((uint32_t)buf[offset + 1u] << 16) |
           ((uint32_t)buf[offset + 2u] << 8) |
           (uint32_t)buf[offset + 3u];
    return true;
}

int main(void) {
    const uint8_t packet[] = {0x99u, 0x12u, 0x34u, 0x56u, 0x78u};
    uint32_t result = 0u;
    if (!read_u32_be(packet, sizeof packet, 1u, &result)) return 1;
    if (result != UINT32_C(0x12345678)) return 2;
    if (read_u32_be(packet, sizeof packet, 2u, &result)) return 3;
    if (read_u32_be(packet, sizeof packet, 99u, &result)) return 4;
    if (read_u32_be(NULL, sizeof packet, 0u, &result)) return 5;
    if (result != UINT32_C(0x12345678)) return 6;
    const uint8_t max_packet[] = {0xFFu, 0xFFu, 0xFFu, 0xFFu};
    uint32_t max_result = 0u;
    if (!read_u32_be(max_packet, sizeof max_packet, 0u, &max_result)) return 7;
    if (max_result != UINT32_MAX) return 8;
    printf("value=0x%08X\n", (unsigned)result);
    return 0;
}
```

儲存為 `packet.c`，用 `gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic packet.c -o packet && ./packet`。預期 `value=0x12345678`。

## 為什麼不直接 `*(uint32_t *)(buf + offset)`？

直接轉型後解參照可能遇到**未對齊**、CPU Byte Order 與傳輸格式不同、別名規則等問題。這是正確性風險，不是換一個 cast 就能修好。若確定封包用 Little-endian，要改**位元組組合順序**，不能只改本機 CPU 設定。

## 實際上要測什麼

完整四個 bytes、只剩三個 bytes、空封包、offset 超過 len、最大整數 `FF FF FF FF`、NULL，還有題目是否要求回傳錯誤碼或丟棄壞封包。當欄位不是固定四 bytes 或版本可能不同時，先讀規格再改解析方式。

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`parse_be_bounds.c`），與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。使用 `gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic -pthread` 編譯後執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```c
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

static bool read_be32(const uint8_t *buf, size_t len, size_t offset, uint32_t *result) {
    if (buf == NULL || result == NULL || offset > len || len - offset < 4) return false;
    *result = ((uint32_t)buf[offset] << 24) | ((uint32_t)buf[offset+1] << 16) |
              ((uint32_t)buf[offset+2] << 8) | (uint32_t)buf[offset+3];
    return true;
}
int main(void) {
    const uint8_t bytes[]={0xff,0x12,0x34,0x56,0x78,0x00};
    uint32_t output=0;
    if (!read_be32(bytes,sizeof bytes,1,&output) || output != UINT32_C(0x12345678)) return 1;
    if (read_be32(bytes,sizeof bytes,3,&output)) return 2;
    if (read_be32(bytes,sizeof bytes,(size_t)-1,&output)) return 3;
    if (read_be32(NULL,0,0,&output) || read_be32(bytes,sizeof bytes,0,NULL)) return 4;
    if (read_be32(bytes,0,0,&output)) return 5;
    puts("big-endian + offset boundary checks PASS");
    return 0;
}
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。
