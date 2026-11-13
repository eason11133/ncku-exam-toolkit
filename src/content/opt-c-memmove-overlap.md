---
id: opt-c-memmove-overlap
title: 來源與目的重疊時要用 memmove
category: C Programming
tags: C Programming, c-memcpy-overlap, 考場判讀
aliases: opt-c-memmove-overlap, 來源與目的重疊時要用 memmove
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/string/byte/memmove
verified: false
updated_at: 2026-11-13
summary: 記憶體範圍有重疊就不能改用 memcpy 賭運氣。
related: ncku-v2-c-memcpy-overlap
---

# 來源與目的重疊時要用 memmove

## 常見錯誤

在同一個陣列中插入或刪除資料時，`memcpy(dst, src, n)` 的兩塊記憶體可能重疊。C 規格對重疊 `memcpy` 不保證結果；`memmove` 則按「先暫存原始 bytes，再覆寫」的效果處理，**實際實作不一定真的配置暫存陣列**。

<!-- test: full-c -->
```c
#include <stdio.h>
#include <string.h>
int main(void) {
    char s[8] = "abcdef";
    memmove(s + 1, s, 6); /* 包含 6 個字元，不含原 '\0' */
    s[7] = '\0';
    if (strcmp(s, "aabcdef") != 0) return 1;
    puts(s);
    return 0;
}
```

## 邊界與效能

這裡目的地 `s[1..6]` 仍在 `s[0..7]` 範圍內。換成 `memmove` **不能補救容量不足**。即使實測 `memcpy` 更快，也不能在確定重疊時使用它；若資料可用 `head` 索引表達，可進一步避免整段搬移，但要改完整資料結構與生命週期。

**驗收**：原陣列、修改後陣列與長度逐 byte 比對；測「往左移」「往右移」「不重疊」「長度零」與滿容量情況。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/string/byte/memmove
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 真正理解：移動順序為什麼重要？

假設陣列容量是 8，內容是 `abcdef\0`。要在最前方插入一個 `a`，必須把原本 `a..f` 整段往右推一格。來源是 `s[0..5]`，目的地是 `s[1..6]`。這兩段都涵蓋 `s[1..5]`，所以重疊。

`memmove(s+1,s,6)` 的語意是先記住原始的 6 bytes，再把它們寫到新位置；編譯器可以用更省記憶體的方法做到同樣效果。如果用 `memcpy`，重疊時在 C 標準下就是未定義行為，不能靠「這次跑得對」下注。

### 同一個陣列向左刪除與向右插入（完整 C11）

<!-- v7-test: full-c -->
```c
#include <stdio.h>
#include <string.h>
int main(void) {
    char x[9] = "abcdef";
    /* 刪掉最前面的 a：搬 b..f 與結尾 \0，共 6 bytes */
    memmove(x, x + 1, strlen(x));
    if (strcmp(x, "bcdef") != 0) return 1;
    /* 在最前面插入 Z：搬 b..f 和 \0，共 6 bytes */
    size_t count = strlen(x) + 1;
    if (count + 1 > sizeof x) return 2;
    memmove(x + 1, x, count);
    x[0] = 'Z';
    if (strcmp(x, "Zbcdef") != 0) return 3;
    puts(x);
    return 0;
}
```

### 什麼情況改了也沒用？

如果原本只有 6 bytes 的儲存空間，`memmove` 不能幫你長出第 7 byte。也不能在 source 不可讀或 dst 不可寫時使用。若要大量刪除前端元素，可改用 head 索引或環形緩衝區，減少反覆搬移；但邏輯索引與容量管理會更複雜。

**自己想一題：** 刪除字串最後一個字元時，一定要呼叫 memmove 嗎？試試直接修改 `s[len-1]='\0'`，並說明為什麼對這個需求夠用。
