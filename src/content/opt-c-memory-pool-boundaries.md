---
id: opt-c-memory-pool-boundaries
title: Memory Pool 何時值得做：對齊、回收與失敗處理
category: C Programming
tags: C, memory pool, alignment, lifetime
aliases: opt-c-memory-pool-boundaries, Memory Pool 何時值得做
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/w/c/memory/malloc
verified: false
updated_at: 2026-11-13
summary: Memory Pool 只能在確定配置是熱點時使用；先定義大小、對齊、生命週期。
related: ncku-v2-c-allocator-fragmentation
---

# Memory Pool 不應該是「malloc 太慢」的第一個答案

如果大量短命、固定尺寸物件反覆配置，pool 或 arena 可能減少一般 allocator 成本。但它會增加額外規則：何時能重用、容量不夠怎麼辦、不同 thread 能不能同時配置、指標是否仍有效。

## 先用最小結構想清楚所有權

```text
Pool: 一次取得大塊記憶體
  ├─ slot 0: 狀態 FREE 或 IN_USE
  ├─ slot 1: 狀態 FREE 或 IN_USE
  ├─ slot 2: 狀態 FREE 或 IN_USE
  └─ slot N-1
取得：必須找到閒置 slot；沒有空間時回傳失敗或明訂回退策略
歸還：不得重複歸還、不得在使用中就歸還
關閉：確認所有借出的 slot 都不再被引用
```

這是架構說明，不是可複製成 C 的完整 allocator。**C 物件的對齊要求**不會因為你切成固定 bytes 就自動成立；`char buffer[4096]` 的任意 offset 不能一概拿來轉成 `double*` 或帶更高 alignment 的 struct。至少要使用適當對齊的儲存區及每個 slot 的步長，並確認平台 ABI。

## 跟其他方案比較

若物件有固定上界，直接建立固定陣列或預配置 vector 通常比設計 pool 容易驗證。若資料會跨 Callback 或執行緒傳遞，必須讓所有借用者在歸還前完成。多執行緒同時修改 free list 需要同步，沒有同步的「高速 pool」反而可能產生 data race 或 double free。

**驗收不能只看速度**：配備成功／失敗計數、分配與釋放配對、對齊測試、滿池時策略、峰值記憶體、ASan／UBSan。只有確認 allocation 確實是瓶頸，且最簡單的預配置方案不足時，再考慮 pool。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 用小例子把「借用、歸還」想清楚

先別急著自己寫通用 malloc。假設程式只需要最多 3 個 `int` 工作槽，就用一個固定陣列配合占用標記；這足以理解 pool 的生命週期，也比較容易檢查。

<!-- v7-test: full-c -->
```c
#include <stdio.h>
#include <stdbool.h>
typedef struct { int values[3]; bool used[3]; } Pool;
static int claim(Pool *p) {
    for (int i=0; i<3; ++i) if (!p->used[i]) {
        p->used[i]=true; p->values[i]=0; return i;
    }
    return -1;
}
static bool release_slot(Pool *p, int id) {
    if (id<0 || id>=3 || !p->used[id]) return false;
    p->used[id]=false; return true;
}
int main(void) {
    Pool p={0};
    int a=claim(&p), b=claim(&p), c=claim(&p);
    if (a!=0 || b!=1 || c!=2 || claim(&p)!=-1) return 1;
    p.values[a]=42;
    if (p.values[a]!=42 || !release_slot(&p,b)) return 2;
    if (release_slot(&p,b)) return 3; /* double release 不可通過 */
    if (claim(&p)!=b) return 4;
    puts("pool lifecycle ok"); return 0;
}
```

這只是一個**單執行緒、固定 int 槽位**的教學模型，不是通用 Memory Pool。真實 pool 若要回傳任意型別指標，還要處理對齊、指標在歸還後失效、跨 Thread 同步和容量不足的策略。

**為什麼不一定值得？** 對只跑一次的小程式，普通 `malloc`／`free` 較簡單。先用 Profiler 證實配置真的是熱點，再考慮池化。
