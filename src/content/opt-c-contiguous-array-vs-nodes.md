---
id: opt-c-contiguous-array-vs-nodes
title: 連續陣列與指標串列怎麼選
category: Performance Engineering
tags: Performance Engineering, cpu-memory-locality, 考場判讀
aliases: opt-c-contiguous-array-vs-nodes, 連續陣列與指標串列怎麼選
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/language/object
verified: false
updated_at: 2026-11-13
summary: 大量順序讀取通常先評估連續儲存，但不要無視插入與引用需求。
related: ncku-memory-locality
---

# 連續陣列與指標串列怎麼選

## 兩種資料的差異

陣列中的資料在記憶體地址上連續；linked list 的 node 可能散在各處，每一步要追指標。順序掃描大量資料時，陣列往往比較有 cache 效率；但若一定要保持節點穩定位址或在已知節點附近頻繁插入，選擇可能不同。

<!-- test: full-c -->
```c
#include <stddef.h>
#include <stdio.h>
typedef struct Node { int v; struct Node *next; } Node;
int main(void) {
    const int a[4] = {1,2,3,4};
    Node n[4] = {{1,&n[1]},{2,&n[2]},{3,&n[3]},{4,NULL}};
    int arr=0, lst=0;
    for (size_t i=0;i<4;++i) arr+=a[i];
    for (Node *p=n;p;p=p->next) lst+=p->v;
    if (arr!=10 || lst!=arr) return 1;
    printf("array=%d list=%d\n", arr, lst);
    return 0;
}
```

這裡的 `Node n[4]` 仍是連續配置，只用於展示不同走訪方式；**不能用這個小例子證明 heap 上分散節點的效能**。要比較現實效能，請在相同測資上使用真正的配置策略並記錄 allocation overhead、查找、插入與遍歷時間。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/language/object
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 深讀延伸｜把原理放進真實情境
## 用記憶體畫面理解陣列與 Linked List

假設有四筆 `int`，陣列 `a[0..3]` 的元素在記憶體中連續排列，順序掃描容易利用 CPU cache line：拿到第一段資料時，附近元素可能已被帶進 Cache。鏈結串列的每個 node 卻可能配置在不同位置，CPU 必須讀完 `next` 指標才知道下一個節點在哪，容易產生更多 cache miss。

不過陣列不是永遠較好。若你需要大量在**已知節點位置**插入或刪除，鏈結串列可以避免整段元素搬移；但找到那個節點可能仍要 O(N)，而且會付出指標、配置和局部性的成本。不要把「插入 O(1)」偷換成「先找位置再插入也 O(1)」。

判斷前問三件事：資料最常是依序掃描還是任意插入？需不需要持續持有元素位址？資料成長時重新配置會不會讓舊指標失效？例如 C 的 `realloc` 成功後可能搬到新位置，**原指標與內部元素指標都不能直接沿用**。

**練習：** 一百萬筆感測器資料只需要每秒算一遍總和，優先考慮連續陣列；若是一個頻繁插入且其他模組持有節點指標的結構，才仔細評估其他容器。這是設計方向，真正效能仍需測目標工作負載。
