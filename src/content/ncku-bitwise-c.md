---
id: ncku-bitwise-c
title: C 位元運算：Mask、Shift、欄位取出與合併
category: C Programming
tags: bitwise, AND, OR, XOR, mask, shift, uint32_t, PIO
aliases: bit masking, 位元遮罩, 左移, 右移, 封包解析
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/language/operator_arithmetic.html
verified: false
updated_at: 2026-11-12
summary: 對照官方 demo_asm.c 的 0xA5，讀懂設定、清除、取出位元與組合欄位的寫法。
related: ncku-pio-dataflow, ncku-c-memory
---
# C 位元運算：先看每一個 bit

官方 2-2 `demo_asm.c` 使用 `uint32_t x = 0xA5`，其低八位是 `1010 0101`。

| 寫法 | 結果 | 意義 |
|---|---|---|
| `x & 0x0Fu` | `0x05` | 只保留低 4 bit |
| `x \| 0x0Fu` | `0xAF` | 低 4 bit 設成 1 |
| `x ^ 0xFFu` | `0x5A` | 翻轉低 8 bit |
| `(~x) & 0xFFu` | `0x5A` | 只看低 8 bit 的 NOT |
| `x << 4` | `0xA50` | 向左移四位 |
| `x >> 4` | `0xA` | 將低八位往右移四位 |

C 的 `~x` 會翻轉**整個型別寬度**，例如 `uint32_t` 是 32 bit；想看低八位要再 `& 0xFFu`。

## 三個最常用的寫法

```c
#include <stdint.h>

uint32_t set_bit(uint32_t x, unsigned b) {
    return x | (UINT32_C(1) << b);   // b 必須在 0..31
}
uint32_t clear_bit(uint32_t x, unsigned b) {
    return x & ~(UINT32_C(1) << b);
}
unsigned read_bit(uint32_t x, unsigned b) {
    return (x >> b) & 1u;
}
```

這裡 `1u` 是 unsigned 常數，`uint32_t` 保證 32 位元。**b 不得大於或等於 32**；負數左移、移位量超出型別位數等情況會有問題。不要用帶號整數去做還未確認的位元運算。

### 讀取欄位（例如 bit 7..4）

```c
uint32_t high_nibble = (x >> 4) & 0xFu;  // 0xA
```

順序是先把需要的欄位移到最右邊，再遮掉其他位元。若要把 value 放進某個已存在的位元欄位，先**清除目標欄位**，再把遮罩後的值左移放入：

```c
uint32_t replace_bits_8_to_11(uint32_t word, uint32_t value) {
    const uint32_t mask = 0xFu << 8;
    return (word & ~mask) | ((value & 0xFu) << 8);
}
```

若 `value` 有超出 4 bit 的內容，這個函式會截掉；如需報錯就必須先檢查範圍。

## 容易失敗的地方

- `&` 是位元 AND，`&&` 是邏輯 AND；`|` 與 `||` 也不同。
- `^` 是 XOR，不是乘方。Python 的 `**` 才是冪次。
- `1 << 31` 可能因 signed int 出問題；對 32 位欄位用 `UINT32_C(1) << 31`。
- `0x1234` 是數值，不等於記憶體中的固定 byte 順序。跨網路或硬體傳輸要確認 endianness。
- 右移 signed 負數的行為不能當成平台無關的封包解析方式。

### 位元運算記得加括號

假設要檢查整數的低四位是不是 `0x05`，應寫成：

```c
if ((x & 0x0Fu) == 0x05u) {
    /* 低四位是 0101 */
}
```

不要省略成 `x & 0x0Fu == 0x05u`。在 C 裡，`==` 的優先順序比位元 `&` 高，後者會先把 `0x0Fu == 0x05u` 算成假，再與 `x` 做 AND，意思完全不同。

位移 `<<`、`>>` 的優先順序高於位元 `&`，但遇到欄位擷取、比較或混合不同運算子時，**把遮罩及位移範圍括起來**最容易閱讀，也比較不會寫錯。

來源：<https://en.cppreference.com/c/language/operator_precedence>。

## 比較兩種解析方式

例如 16-bit 傳輸資料前 8 bit 是類型、後 8 bit 是數值：

```c
uint16_t packet = 0x1234;
uint8_t type = (uint8_t)((packet >> 8) & 0xFFu);
uint8_t value = (uint8_t)(packet & 0xFFu);
```

測試時至少放入 `0x0000`、`0xFFFF`、邊界欄位、單一 bit set，再檢查結果。若修改封包格式還要確認另一端是否同步改變。

**效能注意：** 位元運算本身通常便宜，實際瓶頸也可能是反覆編碼解碼、資料複製、記憶體存取或 IO。先量測再優化。

來源：[C arithmetic operators](https://en.cppreference.com/w/c/language/operator_arithmetic.html)；成大 2-2 `demo_asm.c`（原始碼資料彙整）。
