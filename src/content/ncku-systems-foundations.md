---
id: ncku-systems-foundations
title: 系統底層觀念：CPU、記憶體、暫存器、Cache 和 Endianness
category: Systems
tags: CPU, RAM, register, cache, memory address, stack, heap, endian, bandwidth
aliases: register, endian, stack heap, memory bandwidth, computer architecture
difficulty: intermediate
priority: P1
source_type: personal
source_url: https://en.cppreference.com/w/c/language/object.html
verified: false
updated_at: 2026-11-12
summary: 連起 C 指標、位元欄位、PIO FIFO 和 DMA 搬運需要的硬體背景觀念。
related: ncku-c-memory, ncku-transfer-engine, ncku-pio-dataflow
---
# 系統底層觀念：看程式到底在操作什麼

**CPU** 執行指令；**RAM** 放程式和資料；**Register（暫存器）** 是 CPU 或周邊裝置中的小型儲存單位。**Memory address** 是程式用來指定記憶體位置的數值，**Pointer** 則是 C 用來存放這類位址的型別。

這幾個詞的關係可以這樣理解：

```text
C: uint32_t x = 7;
CPU 執行運算指令 → 資料可能被放入暫存器計算 → 結果寫回 x 的記憶體位置
```

編譯器可能優化掉部分寫入，所以這是概念流程，不是保證每行 C 都會產生指定的讀寫指令。

## Stack 與 Heap

- Stack 一般用來管理函式呼叫框架與局部物件，但實際儲存與優化由編譯器決定。
- Heap 是動態記憶體管理區域，常由 `malloc`/`free` 控制。
- `static` 或全域變數通常有靜態儲存期；不能直接把所有變數簡單分成「stack or heap」。

Python list 會管理元素容量與引用；C 指標不保證能知道底層陣列大小。即使 `uint32_t *p` 指向合法資料，也不能無限增加 `p` 來讀取記憶體。

## Byte、Bit 與 Endianness

一個 byte 通常是 8 bits（目標平台需確認 `CHAR_BIT`）；`uint32_t` 是 32-bit 無號整數。**數值** `0x12345678` 和**記憶體中的四個 bytes 順序**不同。

- Little-endian 可能按位址由低至高存成 `78 56 34 12`。
- Big-endian 可能存成 `12 34 56 78`。

跨硬體通訊要依規格寫明端序；不能單靠在自己電腦測一次就認定所有硬體相同。

## Cache、Alignment、Bandwidth

- **Cache** 會保留常用記憶體內容；連續存取常較容易利用空間局部性，但收益取決於存取模式和硬體。
- **Alignment（對齊）**：例如 4-byte 資料可能要求位址為 4 的倍數，對 DMA／硬體暫存器尤需看規格。
- **Memory bandwidth**：記憶體在單位時間能搬多少資料。資料複製、DMA 和多核心計算可能爭用同一帶寬。
- **Cache coherence** 保證一般多核心快取的一致性機制，但它不能取代多執行緒程式的 atomic/lock；資料競爭仍需依語言記憶體模型處理。

## 陷阱：快取好，不代表永遠更快

把每筆資料改為跨記憶體跳躍存取可能讓 cache miss 增加；把資料變成緊密陣列可能改善連續掃描。但如果程式根本在等 I/O，調整 cache 也不一定有用。先量測，再確認瓶頸是 CPU、Memory 還是 I/O。

參考：[C object](https://en.cppreference.com/w/c/language/object.html)、[C memory model](https://en.cppreference.com/w/c/language/memory_model.html)。
