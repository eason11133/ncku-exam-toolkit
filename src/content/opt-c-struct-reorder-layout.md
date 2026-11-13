---
id: opt-c-struct-reorder-layout
title: struct 為什麼有空洞？用 sizeof、_Alignof、offsetof 自己量
category: C Programming
tags: C Programming, c-struct-packing, sizeof, offsetof, alignment, padding
aliases: opt-c-struct-reorder-layout, struct 欄位順序, Padding
priority: P0
difficulty: intermediate
source_type: personal
source_url: https://en.cppreference.com/w/c/language/object
verified: false
updated_at: 2026-11-13
summary: 用實際 C11 程式觀察 padding、欄位位移與對齊，並說明何時不能調換欄位。
related: ncku-v2-c-struct-packing, ncku-c-language-bridge, ncku-binary-packet-parsing
---

# struct 只有 1 + 4 + 1 bytes，為什麼可能不只 6 bytes？

你知道 Python 的 `dict` 能把不同欄位放在一起。C 的 `struct` 也可以，但 C 要決定每個欄位在記憶體中放哪裡。某些型別希望從特定倍數的位址開始，例如一個 4-byte 整數在常見平台會希望位址是 4 的倍數。

因此編譯器可能在欄位中間塞入**沒有用來存欄位值的空間**，叫做 Padding。你不能只把所有欄位的 `sizeof` 相加，就當成整個 `struct` 的大小。

## 先看兩種寫法

```c
struct A { uint8_t a; uint32_t b; uint8_t c; };
struct B { uint32_t b; uint8_t a; uint8_t c; };
```

它們存的資料型別相同，但欄位順序不一樣。在常見的 32-bit `uint32_t` 對齊為 4 bytes 的平台，A 可能佔 12 bytes，B 可能佔 8 bytes。**這只是常見平台的例子，不是 C 語言保證的固定數字。**

## 完整 C11 程式：自己看位址差和大小

<!-- test: full-c -->
```c
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

struct A { uint8_t a; uint32_t b; uint8_t c; };
struct B { uint32_t b; uint8_t a; uint8_t c; };

int main(void) {
    printf("A size=%zu align=%zu, b offset=%zu, c offset=%zu\n",
           sizeof(struct A), _Alignof(struct A),
           offsetof(struct A, b), offsetof(struct A, c));
    printf("B size=%zu align=%zu, a offset=%zu, c offset=%zu\n",
           sizeof(struct B), _Alignof(struct B),
           offsetof(struct B, a), offsetof(struct B, c));

    struct A one = { .a = 0x56u, .b = UINT32_C(0x12345678), .c = 0x9au };
    struct B two = { .b = one.b, .a = one.a, .c = one.c };
    if (one.a != two.a || one.b != two.b || one.c != two.c) return 1;
    if (offsetof(struct A, b) <= offsetof(struct A, a)) return 2;
    if (offsetof(struct B, c) <= offsetof(struct B, a)) return 3;
    return 0;
}
```

你可以直接用下面指令編譯（檔名假設是 `struct_layout.c`）：

```bash
gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic struct_layout.c -o struct_layout
./struct_layout
```

**這幾個關鍵字各代表什麼？**

- `sizeof(struct A)`：整個物件佔多少 **bytes**，包含可能的 Padding。
- `_Alignof(struct A)`：這個型別在該編譯環境需要怎樣的位址對齊（C11）。
- `offsetof(struct A, b)`：成員 `b` 距離整個物件起點幾個 **bytes**，從 0 開始算。
- `.a = ...`：指定欄位初始化，避免改欄位順序時不小心把值放錯欄位。

## 怎麼判斷要不要改？

如果有數十萬個 `struct A` 放在一個陣列，且實測 `sizeof(A) > sizeof(B)`，改成 B **可能**減少記憶體占用。但這不一定讓程式更快：CPU 快取命中、資料存取順序和後續轉換成本也會影響速度。

更重要的是：如果別人靠固定的成員位移讀你的資料，或程式要跟 C 外部介面、硬體暫存器、二進位檔案對接，**擅自調換欄位可能直接讀錯**。這種情況先確認 ABI／協定，不是看到「少了 4 bytes」就改。

## 千萬不要把 struct 直接當封包格式

例如 `fwrite(&one, sizeof(one), 1, file)` 會把物件表示（含可能的 Padding、平台位元組序）直接寫出去；換一種編譯器或硬體不一定能用同樣方式解回來。

如果協定要求 `a` 佔 1 byte、`b` 用 big-endian 佔 4 bytes、`c` 佔 1 byte，就明確輸出這 6 bytes：

```c
/* 此片段需放在 main 裡，並且前面已宣告 struct A one */
uint8_t wire[6] = {
    one.a,
    (uint8_t)(one.b >> 24), (uint8_t)(one.b >> 16),
    (uint8_t)(one.b >> 8),  (uint8_t)one.b,
    one.c
};
/* 這才是明確定義的格式，不會連 Padding 一起送出去 */
```

## 遇到變形題怎麼選

如果考題強調「在自己的程式裡存大量紀錄」：量 `sizeof`／存取效能，可能可調欄位順序。

如果強調「讀取別人給的 raw bytes」或「送給不同裝置」：先看協定指定的長度與端序，別直接 Cast 成 `struct*`。

如果是 PIO／DMA 的硬體資料描述：還要檢查實際位址對齊、transfer width、buffer 生命週期，不能只比較 `sizeof`。

**驗證狀態：** 完整 C 範例能在有 GCC 的 Linux 測試；本文沒有替不同 ABI 或硬體背書。`wire` 是有前置宣告需求的程式片段，不能單獨執行。

來源：C 物件與對齊 https://en.cppreference.com/w/c/language/object；C `struct` https://en.cppreference.com/w/c/language/struct.html
