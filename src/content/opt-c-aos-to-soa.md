---
id: opt-c-aos-to-soa
title: 只頻繁讀某一欄時，才考慮 AoS 改 SoA
category: Performance Engineering
tags: Performance Engineering, cpu-memory-locality, 考場判讀
aliases: opt-c-aos-to-soa, 只頻繁讀某一欄時，才考慮 AoS 改 SoA
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/language/object
verified: false
updated_at: 2026-11-13
summary: 資料布局要看真正的存取模式，轉換也有成本。
related: ncku-memory-locality
---

# 只頻繁讀某一欄時，才考慮 AoS 改 SoA

## 先辨別存取模式

AoS：`struct Point points[N]`，每筆有 x/y/z。SoA：三個獨立陣列 `xs/ys/zs`。若只掃大量 x，SoA 可能改善 cache 使用；若每筆同時用三欄，AoS 也可能更合適。

<!-- test: full-c -->
```c
#include <stdio.h>
#include <stdint.h>
struct Point { int x,y,z; };
int main(void) {
    const struct Point aos[4] = {{1,8,9},{2,8,9},{3,8,9},{4,8,9}};
    const int xs[4] = {1,2,3,4};
    int64_t sum_a=0, sum_s=0;
    for (int i=0;i<4;++i) { sum_a+=aos[i].x; sum_s+=xs[i]; }
    if (sum_a != 10 || sum_a != sum_s) return 1;
    printf("aos=%lld soa=%lld\n", (long long)sum_a, (long long)sum_s);
    return 0;
}
```

## 驗證限制

此範例只證明結果相同，**沒有證明 SoA 比 AoS 快**。正式測試需要大量代表性資料、不同欄位比例和多輪結果；轉換資料本身也要計入端到端耗時。若要對外傳輸，不可因 AoS/SoA 改動就跳過既有 wire format。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/language/object
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 把記憶體中的排列實際畫出來

AoS (`struct Point {x,y,z;}`) 若欄位都是 4-byte int，四筆資料的排列大致是 `x0,y0,z0,x1,y1,z1,...`。SoA 則把 `x0,x1,x2,x3` 擺在一起，再放 y 和 z。當每次運算都只讀 x 時，SoA 讓相鄰 x 更容易一起被 Cache 取到。

但如果每筆都同時用到 x/y/z，AoS 能讓同一筆的三個欄位靠在一起，可能更方便。這兩個設計沒有誰永遠比較快，還要看真實欄位寬度、CPU Cache、向量化及資料轉換成本。

### 先證明兩種表示做的是同一件事（純 Python 表示法）

<!-- v7-test: full-python -->
```python
points = [(1, 8, 9), (2, 8, 9), (3, 8, 9), (4, 8, 9)]
xs = [p[0] for p in points]
if not (sum(p[0] for p in points) == sum(xs) == 10):
    raise RuntimeError("check failed: opt-c-aos-to-soa")
# 如果下一步還要每筆的 y/z，也必須保留欄位對應索引。
ys = [p[1] for p in points]
zs = [p[2] for p in points]
if not (list(zip(xs, ys, zs)) == points):
    raise RuntimeError("check failed: opt-c-aos-to-soa")
print('same results; no speed measurement')
```

**變形題：** 如果資料會頻繁在中間插入一筆，三個 SoA 陣列都要插在同一 index，否則 x、y、z 會指到不同筆資料。這個成本可能抵銷掃描速度的好處。
## 為什麼改資料排列，真的可能影響速度？

原本每個點是一個 `struct Point {int x,y,z;}`，很多點連成 `points[]`。這是 AoS（Array of Structures）：第 0 個點的 x/y/z 在一起，第 1 個點的 x/y/z 再放在一起。若你每次都要處理整個點，這樣很好讀也可能很合適。

但假設計算只會讀所有點的 `x`。每讀一個 `x`，記憶體中旁邊可能還夾著用不到的 `y,z`；CPU Cache 抓進一整段資料時，就可能載入不少這次用不到的內容。SoA（Structure of Arrays）把所有 `x[]`、`y[]`、`z[]` 分開，掃 `x[]` 時資料會比較連續。

### 怎麼選？

- 一次要讀同一個點的 x、y、z：AoS 往往直觀，可能不需要動。
- 大量迴圈只讀一個欄位：SoA 值得評估。
- 資料量很小：改布局的成本可能比節省的時間更大。
- 外部 API 要求固定 `struct` 或指標必須保持有效：不能只為快就改掉 ABI／指標規則。

**複雜度沒有自動改變**：兩種方法遍歷 N 個點，仍是 O(N)。差別主要在實際存取和 Cache 效率，不是把演算法從 O(N) 魔法變成 O(log N)。

### 驗收

用同一批資料，逐點比對 AoS/SoA 的 x、y、z 和最後計算結果。若改布局時要額外做一次資料重排，量測整體耗時必須把這段成本算進去。記憶體大小和 Cache line 是平台特性，不能直接宣稱每台電腦固定 64 bytes。
