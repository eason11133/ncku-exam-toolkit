---
id: opt-transfer-last-chunk-split
title: Double Buffer 分塊時最後一塊可能不足 Chunk Size
category: Embedded Systems
tags: Embedded Systems, transfer-double-buffer, 考場判讀
aliases: opt-transfer-last-chunk-split, Double Buffer 分塊時最後一塊可能不足 Chunk Size
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/string/byte/memcpy
verified: false
updated_at: 2026-11-13
summary: 切塊要保留最後不足一整塊的資料，且每筆單位換算正確。
related: ncku-v2-transfer-double-buffer
---

# Double Buffer 分塊時最後一塊可能不足 Chunk Size

## 常見錯誤

把資料長度 N 切成大小為 K 的 chunk，若 `N % K != 0`，最後一塊長度必須特別處理。錯把每塊都當 K 個元素，可能超出來源 Buffer 或把舊資料傳出去。對官方 Transfer Engine，**count 指傳輸筆數，size 指每筆幾個 bytes**；先檢查單位。

## 完整 Python：切分並精確重組

<!-- test: full-python -->
```python
payload=bytes(range(10))
chunk_size=4
assert chunk_size>0
chunks=[payload[i:i+chunk_size] for i in range(0,len(payload),chunk_size)]
assert [len(c) for c in chunks]==[4,4,2]
assert b''.join(chunks)==payload
print('chunk sizes',[len(c) for c in chunks])
```

若改成 32-bit words，還要先確認每筆 bytes 數和 Buffer 對齊；不要將 `len(payload)`（bytes）直接填成 `count`。上面只是 Buffer 切分的正確性示例，**不是真正 DMA 或 pthread Transfer Engine**。

**驗收**：空資料、一筆、剛好整除、最後剩一筆、chunk size 大於資料長度；每一塊加序號/校驗，確認全程不丟、不重、不越界。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/string/byte/memcpy
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 深讀延伸｜把原理放進真實情境
## 最後一塊資料不能偷偷消失

資料共有 10 個元素、每塊最多 4 個。正確的分塊長度是 `[4,4,2]`，不是 `[4,4]`，也不是 `[4,4,4]`。第一種漏掉最後 2 個，第二種可能讀到來源以外的資料或寫超出目標容量。

對 C 的固定陣列，可先算 `remain = total - offset`，前提 `offset <= total`；再取 `take = remain < CHUNK ? remain : CHUNK`。若傳輸 API 的 `count` 代表元素數，這裡 `take` 就是個數；若你的工作以 bytes 表示，必須重新檢查單位。

Double Buffer 要再注意一件事：兩塊 Buffer 輪替使用時，下一輪開始覆寫某塊之前，必須先確認**上一筆傳輸和上一筆消費該塊的工作都已完成**。光是 `wait_transfer` 完不代表 Consumer 已經用完 buffer；同時開始下一筆可能導致讀到被覆寫的資料。

**紙筆推演：** `buf[0]` 收第 0 塊、`buf[1]` 收第 1 塊、`buf[0]` 要收第 2 塊。若處理第 0 塊的 CPU 工作還沒結束，第 2 次搬運能否立即覆寫 `buf[0]`？不能。要建立 buffer 所有權與交接點，否則 Pipeline 會因重用過早而破壞正確性。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：最後一塊最容易越界

有 10 個 `uint32_t`，每次要搬最多 4 個。三輪應分別搬 4、4、2 個，不是 4、4、4。若 API 的 `count` 是**元素筆數**，最後一輪 `count=2`；若先把 `count` 誤當 byte 數，或在已經算 `offset` 的情況下再次乘錯 `sizeof(T)`，就可能越界。

用 `[offset,offset+count)` 推演：第一輪 `[0,4)`、第二輪 `[4,8)`、第三輪 `[8,10)`。每輪 `count=min(chunk,n-offset)`，`n-offset` 先在保證 `offset<=n` 後才能計算。位址算 `base+offset` 時要確認 `base` 真的指向至少 n 個元素；若用 byte 位移，總長 `n*sizeof(T)` 需先檢查乘法溢位。

**變形題：** 雙 Buffer 裡第一輪資料還在被 CPU 消費，下一輪能不能覆寫它？不能。即使傳輸已完成，Consumer 還沒結束就不算 FREE。別只記住『兩塊輪流』，要記住每塊的所有權狀態。
