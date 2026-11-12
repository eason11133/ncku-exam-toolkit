---
id: ncku-binary-packet-parsing
title: C 二進位封包解析：Endian、Mask、Alignment、Bounds
category: C Programming
tags: endian, byte order, packet, uint8_t, uint32_t, bit shift, alignment
aliases: 大小端序, 封包解析, byte order, 位元組, 網路封包, 資料對齊
source_type: personal
source_url: https://en.cppreference.com/w/c/types/integer.html
verified: false
updated_at: 2026-11-12
summary: 收到 byte 陣列後安全解出欄位；先檢查長度與規格，再談批次解析和減少複製。
related: ncku-bitwise-c, ncku-c-memory, ncku-transfer-engine
priority: P0
difficulty: intermediate
---

# 看到一包 bytes，先確認資料格式再改速度

## Big-endian 和 Little-endian 是什麼？

假設四個 bytes 是 `12 34 56 78`（十六進位）。若規格說它是 32-bit Big-endian 整數，解出的值是 `0x12345678`。如果把同樣四個 bytes 當 Little-endian，值會是 `0x78563412`。

不要靠「我的電腦剛好是 Little-endian」來決定封包規格。**傳輸格式定義的 Byte Order 才是準則。**

## 方案 A：Shift + OR 手動解碼

對四個 Big-endian bytes：

```c
uint32_t value = ((uint32_t)buf[0] << 24) |
                 ((uint32_t)buf[1] << 16) |
                 ((uint32_t)buf[2] << 8)  |
                  (uint32_t)buf[3];
```

這裡 `(uint32_t)` 很重要：先轉成足夠寬度的**無號整數**，再左移，避免把較窄的整數提升成不適合的有號型別後產生問題。

上面的 C 程式碼是 **解析運算片段**，缺少 `buf` 的宣告、長度和輸出參數，不能單獨編譯。整合進解析函式時，讀取前必須確認至少還有 4 bytes；用 `len - offset < 4` 的前提是先確保 `offset <= len`，否則 `size_t` 做無號減法可能下溢。完整的邊界檢查與回傳狀態範例見 `examples/parse_u32_be.c`；頁內上方仍只是片段。

## 方案 B：避免直接 Cast 不明來源的 byte pointer

不建議把這樣的封包直接解讀成 `uint32_t`：

```c
/* 不要假定封包起點對齊、大小端正確 */
uint32_t value = *(const uint32_t *)(buf + 1);
```

原因包括：位址可能不符合對齊要求、CPU 的 Byte Order 可能和封包不同，還可能違反有效型別／別名相關規則。這些是正確性問題，不是單純比較 `memcpy` 和指標 Cast 誰快。

對安全性要求高的資料解析程式，先使用可證明正確的 Shift + OR，或在確認長度後複製進 `uint32_t` 再按格式轉換；不要在未確認環境前追求「零拷貝」而冒險。

## 方案 C：重複解析大量固定欄位，才考慮批次處理

如果封包格式固定、解析次數非常多，可以先測量到底是解碼、記憶體複製、還是資料傳輸慢，再評估：

- 一次走訪連續 buffer，減少反覆查找同一欄位。
- 只解當下需要的欄位，避免把整包資料複製成多個中間物件。
- 若硬體和編譯器適合，可研究向量化；但需確認 endian、對齊和尾端不足一個批次的處理方式。

這些優化**不能省掉長度檢查**。如果資料格式有版本、可變長度、Checksum 或保留位元，還要把規格全部列出來。

## 測試清單

同一個 decoder 至少測試：正常資料、資料長度不足、`offset == len`、很大的 `offset`、零值、最大值（`0xFFFFFFFF`）、錯誤的 Byte Order。若輸入可能是惡意或損毀封包，更需要用 AddressSanitizer／UndefinedBehaviorSanitizer 檢查邊界問題。

最後比較不同輸入長度下的總處理時間，而不是把「少寫幾行 C」當成效能改善。

**查證狀態**：根據 C 整數型別與記憶體安全原則整理；此頁程式碼為片段，未作獨立編譯或特定硬體測速。

來源：[C fixed-width integer types](https://en.cppreference.com/w/c/types/integer.html)、[GCC sanitizers](https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html)。
