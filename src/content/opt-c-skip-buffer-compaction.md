---
id: opt-c-skip-buffer-compaction
title: Queue 可以先移動索引，別每次都搬整段資料
category: C Programming
tags: C Programming, c-memcpy-overlap, 考場判讀
aliases: opt-c-skip-buffer-compaction, Queue 可以先移動索引，別每次都搬整段資料
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/string/byte/memmove
verified: false
updated_at: 2026-11-13
summary: 先判斷能否保留 head/tail，再把 O(n) 搬移改為索引操作。
related: ncku-v2-c-memcpy-overlap
---

# Queue 可以先移動索引，別每次都搬整段資料

## 問題情境

每取出一個元素就 `memmove(a, a+1, ...)`，單次可能搬大量資料。若只需要 FIFO，改為維護 `head`，讀取資料時不必立即移動。這會讓已讀取的前段空間暫時不能直接再次使用，所以要有容量回收或 ring buffer 策略。

<!-- test: full-c -->
```c
#include <stddef.h>
#include <stdio.h>
int main(void) {
    int items[4] = {10, 20, 30, 40};
    size_t head = 0, end = 4;
    long sum = 0;
    while (head < end) sum += items[head++];
    if (sum != 100 || head != end) return 1;
    head = end = 0;  /* 已空才重用整塊區域 */
    printf("sum=%ld head=%zu end=%zu\n", sum, head, end);
    return 0;
}
```

## 不適用與驗收

若必須維持「元素永遠從 `a[0]` 開始」的外部 API，索引改動有相容成本；如果 producer/consumer 同時存取，還得加互斥或原子協定。不要只改 `head++` 卻忘記判斷滿載和 wrap-around。

**驗收**：對同一串 `push/pop` 操作，與 `deque`/簡單原版比輸出順序、元素數量及容量；混合 0 筆、滿載、連續出入與空佇列測資。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/string/byte/memmove
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 深讀延伸｜把原理放進真實情境
## 為什麼每次消費一筆都 `memmove` 會變慢？

假設 Queue 放 `[A,B,C,D,E]`，彈出 A 後你把剩下 4 筆都搬到前面；再彈 B 又搬 3 筆。總共搬 `4+3+2+1=10` 次元素。對 N 筆反覆這樣做，總搬移量可能成長為 O(N²)。若改成 `head` 索引，讀取時只把 `head` 往後走，消費一筆就不必搬整段資料。

但 `head++` 不是完整 Queue。若你還會加入新資料，必須處理 `tail` 位置、容量滿、以及索引到陣列尾端後怎麼循環。環形緩衝區常用 `(index+1)%capacity`，搭配 `count` 區分**空**與**滿**。只有 `head==tail` 卻不記錄額外狀態，兩種情況可能撞在一起。

**用紙筆追：** 容量 3，依序 push 10、20、30（滿），pop 10（head 前進），push 40（tail 繞回），最後 pop 應依序取得 20、30、40。若此時還讀到 10，通常是索引或 count 更新錯。

多執行緒 Queue 還需要鎖或正確的原子同步；把 `head` 換成索引本身**不會自動解決 Data Race**。若消費端可能保留指向 Queue 元素的指標，覆寫槽位前要確認所有權已經交還。

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`ring_wrap_test.c`），與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。使用 `gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic -pthread` 編譯後執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```c
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#define CAP 3
struct ring {int a[CAP]; size_t head,tail,count;};
static bool push(struct ring *r,int value){
    if(r->count==CAP)return false;
    r->a[r->tail]=value;r->tail=(r->tail+1)%CAP;++r->count;return true;
}
static bool pop(struct ring *r,int *value){
    if(r->count==0)return false;
    *value=r->a[r->head];r->head=(r->head+1)%CAP;--r->count;return true;
}
int main(void){
    struct ring r={0};int v;
    if(pop(&r,&v))return 1;
    if(!push(&r,10)||!push(&r,20)||!push(&r,30)||push(&r,40))return 2;
    if(!pop(&r,&v)||v!=10||!push(&r,40))return 3;
    if(!pop(&r,&v)||v!=20)return 4;
    if(!pop(&r,&v)||v!=30)return 5;
    if(!pop(&r,&v)||v!=40||pop(&r,&v)||r.count!=0)return 6;
    puts("ring wrap / full / empty PASS");return 0;
}
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。
