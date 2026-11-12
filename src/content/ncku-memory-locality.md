---
id: ncku-memory-locality
title: CPU 花時間在等記憶體？Cache Locality、AoS／SoA、假共享
category: Memory Management
tags: cache locality, AoS, SoA, false sharing, contiguous memory, memory bandwidth
aliases: 記憶體存取, Cache Miss, 陣列布局, 連續記憶體, 假共享
source_type: personal
source_url: https://en.cppreference.com/w/c/language/struct.html
verified: false
updated_at: 2026-11-12
summary: 計算量沒變但大量資料處理很慢時，檢查資料是否連續、是否搬太多不需要的欄位，以及多執行緒寫入是否互相干擾。
related: ncku-c-memory, ncku-performance-benchmark
priority: P1
difficulty: intermediate
---

# 演算法一樣，資料放在哪裡也會影響速度

CPU 讀記憶體時，常會把附近的一段資料一起帶進 Cache。如果下一筆資料剛好在旁邊，存取通常比較有利；如果每次都要跟著指標跳到別處，則可能需要更多記憶體存取。

但這不是說「array 一定快、linked list 一定慢」；還要看資料大小、工作模式、CPU、最佳化以及是否已經在 Cache 裡。

## 方案 A：只用其中一個欄位時，考慮 SoA

**AoS（Array of Structures）**：每個物件的欄位放在一起。

```c
struct Point { int x, y, z; };
struct Point points[1000];
```

如果工作只讀 `x`，CPU 可能仍需讀取包含 `y`、`z` 的記憶體區塊。

**SoA（Structure of Arrays）**：每個欄位分開存放。

```c
int xs[1000], ys[1000], zs[1000];
```

若主要工作是連續掃描 `x`，SoA **可能**減少不必要的資料搬入，並方便向量化；但如果每次都要一起讀 `x,y,z`，AoS 也可能比較合適。

附件 `examples/memory_layout.c` 會用同一組數據算 `x` 的總和，確認兩種資料布局的輸出相同。它只驗證正確性，資料太小，**不能拿結果當成效能證明**。

## 方案 B：減少不必要的指標跳躍

假設要依序處理一百萬個值。連續的 `int values[]` 往往較好預測，很多分散配置的節點則可能產生較多 Cache Miss。

在陌生 C 程式裡看到每個元素都 `malloc`，可以檢查能否用連續 buffer 或 index 表示，而不必每一步跟著 pointer。**不能直接更換的情況**：其他程式持有原本節點位址、需要穩定的指標、需要頻繁中間插入刪除、或資料所有權會被打亂。

## 方案 C：多執行緒的 False Sharing

即使 Thread A 更新 `counter_a`、Thread B 更新 `counter_b`，看起來沒有共享同一個變數，但若兩者剛好位於同一條 Cache Line，可能發生 False Sharing（假共享），使 Cache Line 在不同 CPU 核心間反覆轉移。

可測試改成每執行緒局部計數，最後合併；若確實是這個瓶頸，再評估對齊或隔離記憶體。不要盲目把每個變數填充成 64 bytes，因為 Cache Line 大小與記憶體配置因平台而異，填充也會增加記憶體使用量。

## 怎麼證明？

1. 先用相同輸入確認 AoS/SoA 或節點／陣列版本結果一致。
2. 比較整體時間與 RSS；不要只量取資料函式，而漏掉資料重新排布的成本。
3. Linux 若有權限，可查 `perf stat`、`perf list` 等，觀察 Cache 相關事件；可用事件依硬體和權限不同。
4. 設計包含少量資料與大量資料的對照。對很小的資料，資料布局差異可能根本不明顯。

**查證狀態**：原理為通用 CPU 記憶體工程概念；附範例可用 C 編譯，未在指定 CPU／考場專案做效能實測。

來源：[C struct](https://en.cppreference.com/w/c/language/struct.html)、[Linux perf stat](https://man7.org/linux/man-pages/man1/perf-stat.1.html)。
