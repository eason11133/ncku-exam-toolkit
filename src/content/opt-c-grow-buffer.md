---
id: opt-c-grow-buffer
title: 安全的 realloc 倍增容量：處理失敗與整數上界
category: C Programming
tags: C, realloc, malloc, capacity, overflow
aliases: opt-c-grow-buffer, 安全的 realloc 倍增容量
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/memory/realloc
verified: false
updated_at: 2026-11-13
summary: C 動態陣列擴容不能直接覆寫指標；必須先檢查容量乘法及配置失敗。
related: ncku-v2-c-allocator-fragmentation
---

# C 動態陣列：為什麼每次只加一格容易慢？

如果每收到一筆資料就 `realloc` 到剛好夠放一筆，可能反覆搬動舊資料。把容量成長設為倍增，通常可以降低擴容次數；但 **realloc 失敗時原區塊仍有效，不能直接把原指標覆寫掉**。

## 完整可編譯 C11 範例

```c
#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <stdio.h>

typedef struct { int *data; size_t len, cap; } Vec;

static int push(Vec *v, int value) {
    if (v->len == v->cap) {
        size_t limit = SIZE_MAX / sizeof *v->data;
        if (v->cap == limit) return 0;
        size_t next = v->cap ? v->cap : 4;
        if (next > limit) next = limit;
        if (v->cap) {
            if (v->cap <= limit / 2) next = v->cap * 2;
            else next = limit;
        }
        if (next <= v->cap) return 0;
        int *tmp = realloc(v->data, next * sizeof *v->data);
        if (!tmp) return 0;
        v->data = tmp;
        v->cap = next;
    }
    v->data[v->len++] = value;
    return 1;
}

int main(void) {
    Vec v = {0};
    for (int i = 0; i < 1000; ++i) {
        if (!push(&v, i * 2)) { free(v.data); return 1; }
    }
    for (int i = 0; i < 1000; ++i)
        if (v.data[i] != i * 2) { free(v.data); return 2; }
    printf("vector=ok len=%zu cap=%zu\n", v.len, v.cap);
    free(v.data);
    return 0;
}
```

這裡先用 `SIZE_MAX / sizeof *v->data` 避免 `capacity * sizeof(element)` 溢位。若你把資料從 C 陣列傳出一個指標，擴容後**所有舊指標都可能失效**，不能再拿它寫資料；索引也要確認有沒有超出 `len`。新的記憶體在 `realloc` 成功後是未初始化內容。

## 怎麼選、怎麼測

倍增不是讓所有程式都更快：若資料規模能預先計算，通常先一次配置剛好容量更簡單；記憶體非常有限時，倍增可能占用額外空間。對固定資料量跑每次擴一格、倍增及預配置三組，記錄配置次數、最高 RSS、總耗時；所有組都必須先用同一批資料逐項比對。

## 驗收範圍與限制

至少測空陣列、1 筆、1000 筆與非 2 的次方長度；再以故障注入模擬 realloc 失敗，確認原資料仍可釋放。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 不會顯示在編譯錯誤裡的兩個陷阱

1. `realloc` 可能移動整個 Buffer。即使地址「這一次剛好沒變」，舊指標或原陣列元素指標在成功後也不能繼續沿用。
2. `new_cap * sizeof(element)` 先乘後檢查已經太晚了。要先用 `SIZE_MAX / sizeof(element)` 算容量上限。

假設一開始 cap=4，放第五筆前才需要擴到 cap=8。這叫「容量（cap）」和「實際長度（len）」分開記。不能因為 cap=8 就讀 data[7]，因為只有前五筆是已經放入的有效元素。

### 用 Python 把倍增過程走一次（不是 C 配置器測試）

<!-- v7-test: full-python -->
```python
cap = 0
history=[]
for length in range(1, 12):
    if length > cap:
        cap = 4 if cap == 0 else cap * 2
        history.append((length, cap))
if not (history == [(1,4),(5,8),(9,16)]):
    raise RuntimeError("check failed: opt-c-grow-buffer")
print('growth points:',history)
```

**不要誤會：** 倍增有攤銷優勢，但這不保證每個 realloc 都很快，更不能直接把程式的總耗時當成 O(1)。如果已知最終需要 1000 筆，預先一次配置也可能更簡單。

---

## 深讀：把長度 `len` 和容量 `cap` 想成「已入住」和「有幾間房」

陣列有 `cap=8` 不代表 `data[7]` 一定放過有效資料。只有 `0 <= index < len` 的元素才是目前的有效內容；`len` 是實際已放幾筆，`cap` 是目前最多可以放幾筆而不用擴容。

| 第幾筆準備加入 | 加入前 `len` | `cap` | 要不要擴容 |
|---|---:|---:|---|
| 第 1 筆 | 0 | 0 | 是，先到 4 |
| 第 4 筆 | 3 | 4 | 否 |
| 第 5 筆 | 4 | 4 | 是，擴到 8 |
| 第 9 筆 | 8 | 8 | 是，擴到 16 |

別把 `realloc` 當成「反正失敗程式就會幫你保留指標」。如果你寫 `v->data = realloc(v->data, bytes);`，回傳 NULL 時**你把原來有效的指標覆蓋掉**，之後就無法釋放或繼續讀舊資料。應先存 `tmp`，確定成功再覆蓋原指標。

而且 `cap * sizeof(element)` 的乘法必須先檢查上界，不能等乘完才問是不是溢位。`realloc` 成功時也可能搬家，舊的元素指標即使「看起來還指向原位置」，也不能繼續使用；用 index 重新取得位置較安全。

**自己回答：** 資料長度已知剛好 1,000 筆，先配 1,024 筆的容量總是最佳嗎？不一定。可以直接配 1,000 筆，省掉擴容；若上限常常不確定，倍增更有價值。這是資料結構策略，不是所有題目都必須選倍增。
