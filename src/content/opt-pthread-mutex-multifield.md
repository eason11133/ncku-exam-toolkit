---
id: opt-pthread-mutex-multifield
title: 跨兩個共享欄位的條件，不能只各自 Atomic
category: Concurrency
tags: Concurrency, pthread-atomic-counter, 考場判讀
aliases: opt-pthread-mutex-multifield, 跨兩個共享欄位的條件，不能只各自 Atomic
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://en.cppreference.com/c/atomic
verified: false
updated_at: 2026-11-13
summary: 一次要維持多欄位一致性時，Mutex 比兩個獨立 Atomic 更直觀。
related: ncku-v2-pthread-atomic-counter
---

# 跨兩個共享欄位的條件，不能只各自 Atomic

## 為什麼兩個 Atomic 不等於「整組原子」

若規格要求 `left == right` 在任一個可觀察狀態都成立，分別 `atomic_fetch_add(left)` 與 `atomic_fetch_add(right)` 之間仍可能被其他 Thread 觀察到差異。若需要一個交易式的跨欄位不變條件，可以讓讀者和寫者共同持同一個 `pthread_mutex_t`。

<!-- test: full-c -->
```c
#include <pthread.h>
#include <stdio.h>
static pthread_mutex_t mu=PTHREAD_MUTEX_INITIALIZER;
static int left,right;
static void *worker(void *unused) {
    (void)unused;
    for (int i=0;i<10000;++i) {
        pthread_mutex_lock(&mu);
        ++left; ++right;
        pthread_mutex_unlock(&mu);
    }
    return NULL;
}
int main(void) {
    pthread_t a,b;
    if (pthread_create(&a,NULL,worker,NULL)!=0) return 1;
    if (pthread_create(&b,NULL,worker,NULL)!=0) { pthread_join(a,NULL); return 2; }
    if (pthread_join(a,NULL)!=0 || pthread_join(b,NULL)!=0) return 3;
    if (left!=20000 || right!=left) return 4;
    puts("both=20000");
    pthread_mutex_destroy(&mu);
    return 0;
}
```

**限制**：所有讀取這兩個欄位的執行緒也必須用同一把鎖保護；只鎖寫者而讀者裸讀仍可能是 data race。Lock 越長競爭越多，別把沒必要的耗時計算放在臨界區。

**驗收**：多執行緒反覆執行，加入讀者在持鎖情況下檢查不變條件；確認錯誤路徑會解鎖，以及輸入最大值不造成整數溢位。通過測試不能證明所有並行 interleaving 均安全，還要做邏輯檢查。

## 來源與驗證界線

- 參考：https://en.cppreference.com/c/atomic
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 深讀延伸｜把原理放進真實情境
## 兩個 Atomic 變數，不等於兩個欄位一起更新是原子的

假設你管理帳戶，`balance` 和 `transaction_count` 都是 atomic。每次交易需要「餘額減 10、次數加 1」成對發生。另一條 Thread 可能剛好在更新第一個欄位之後讀取，看到新餘額配上舊次數。**每個欄位單獨原子**，仍不能保證讀者看到兩欄位的一致快照。

若業務條件要求這兩個欄位互相關聯，常見解法是用同一把 Mutex 包住整個更新，讀取一致快照時也拿同一把 Mutex；或者在需求足夠明確時使用其他正確的版本化同步設計，不能只把兩個變數都宣告成 `_Atomic` 就算完成。

**時間順序追蹤：** T1 寫 balance=90 → T2 讀 balance=90, count=0 → T1 寫 count=1。讀到的組合並不符合「一次完整交易」的狀態。Mutex 要把兩個寫入包在一起，T2 的讀取也在同一把鎖內，才阻止這種中間快照。

計時時別把「拿鎖變慢」當唯一結果。這個改動的第一目標是保留跨欄位不變條件；若原本數據就錯，單純快沒有比較價值。

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`multifield_snapshot_mutex.c`），與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。使用 `gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic -pthread` 編譯後執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```c
#define _POSIX_C_SOURCE 200809L
#include <pthread.h>
#include <stdio.h>
#define WORKERS 4
#define STEPS 1000
struct ledger {long balance; long transactions; pthread_mutex_t mu;};
static struct ledger a={.balance=0,.transactions=0,.mu=PTHREAD_MUTEX_INITIALIZER};
static int failed_thread;
static void *worker(void *ignored) {
    (void)ignored;
    for(int i=0;i<STEPS;++i) {
        if(pthread_mutex_lock(&a.mu)!=0)return &failed_thread;
        a.balance+=10;
        a.transactions+=1;
        if(pthread_mutex_unlock(&a.mu)!=0)return &failed_thread;
    }
    return NULL;
}
int main(void) {
    pthread_t t[WORKERS];
    for(int i=0;i<WORKERS;++i)if(pthread_create(&t[i],NULL,worker,NULL)!=0)return 1;
    for(int i=0;i<WORKERS;++i){void *result=NULL; if(pthread_join(t[i],&result)!=0||result!=NULL)return 2;}
    if(pthread_mutex_lock(&a.mu)!=0)return 3;
    long x=a.balance,y=a.transactions;
    if(pthread_mutex_unlock(&a.mu)!=0)return 4;
    if(x!=10L*WORKERS*STEPS||y!=WORKERS*STEPS)return 5;
    if(pthread_mutex_destroy(&a.mu)!=0)return 6;
    puts("cross-field snapshot and updates PASS");return 0;
}
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。
