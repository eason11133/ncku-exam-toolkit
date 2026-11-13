---
id: opt-c-parser-no-unaligned-cast
title: 二進位封包不做未對齊指標轉型
category: C Programming
tags: C Programming, safe-binary-decoding, 考場判讀
aliases: opt-c-parser-no-unaligned-cast, 二進位封包不做未對齊指標轉型
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/language/object
verified: false
updated_at: 2026-11-13
summary: 先用 bytes 安全解碼，處理對齊、Endian 和來源合法性。
related: ncku-binary-packet-parsing
---

# 二進位封包不做未對齊指標轉型

## 錯誤示範與根本原因

```c
/* 反例：不保證對齊／端序；不要在程式裡這樣做 */
/* uint32_t v = *(const uint32_t *)(buf + 1); */
```

這不只可能違反對齊，還可能違反 C 的 effective type／aliasing；直接 `memcpy(&v,buf+1,4)` 雖可避免未對齊解參照，但**v 仍取決於主機端序**。

## 完整 C11：帶長度檢查的 Big-endian 解碼

<!-- test: full-c -->
```c
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
static int decode(const uint8_t *buf,size_t len,size_t pos,uint32_t *out) {
    if (!buf || !out || pos > len || len - pos < 4) return 0;
    *out = ((uint32_t)buf[pos] << 24) | ((uint32_t)buf[pos+1] << 16) |
           ((uint32_t)buf[pos+2] << 8) | (uint32_t)buf[pos+3];
    return 1;
}
int main(void) {
    const uint8_t b[5] = {0,0x12,0x34,0x56,0x78};
    uint32_t v=0;
    if (!decode(b,5,1,&v) || v != UINT32_C(0x12345678)) return 1;
    if (decode(b,5,2,&v)) return 2;
    puts("decode ok");
    return 0;
}
```

`pos > len` 必須在 `len-pos` 之前先檢查，否則無號 `size_t` 可能下溢。這裡用確定的 5-byte 陣列測試，沒有依賴編譯器剛好可接受未對齊讀取。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/language/object
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：位元組排列和 CPU 整數是兩件事

假設封包內容是 `12 34 56 78`（十六進位），題目規定 Big-endian。你要的是 `0x12345678`。最容易想到的寫法是把 `buf` 轉成 `uint32_t*` 再取值，但這相當於偷偷依賴 CPU 的**對齊要求、記憶體物件型別和端序**。在某台電腦碰巧讀出預期答案，不代表這段程式符合 C 的可攜性要求。

用四次 byte 讀取反而更清楚：`0x12 << 24`、`0x34 << 16`、`0x56 << 8`、`0x78`，把四段 OR 起來。記得先轉成 `uint32_t` **再**移位；也要先確認 `pos<=len`，才能安全判斷 `len-pos>=4`。

可以拿 `buf={0xff,0x12,0x34,0x56,0x78}`、`pos=1` 追一次：剩 4 bytes，成功；改成 `pos=2` 剩 3 bytes，應失敗；改成 `pos=SIZE_MAX`，必須在做 `len-pos` 前就拒絕。若錯誤時你會回傳失敗，最好約定**不改寫呼叫者的 `out`**，測試也要檢查這件事。

**變形題：** 若考題規定 Little-endian，不需要換 CPU，也不必使用不安全的指標轉型；改成 `buf[pos] | buf[pos+1]<<8 | ...` 的明確組合即可。封包格式寫在題目裡，不應讓主機端序代替它做決定。
