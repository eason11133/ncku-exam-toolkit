---
id: ncku-pthread-critical-section
title: pthread、臨界區、Spinlock 與 Race Condition
category: pthread
tags: pthread, race condition, spinlock, mutex, critical section, shared state
aliases: 臨界區, 資料競爭, counter++, 鎖競爭
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_create.html
verified: false
updated_at: 2026-11-12
summary: 認出 counter++ 為何可能少算、鎖如何修正，以及鎖太久為什麼又拖慢效能。
related: ncku-performance-benchmark, ncku-transfer-engine
---
# pthread 與臨界區

官方 2-3 有兩個 worker，各加 `counter` 20000 次，理想結果是 40000。第一版沒鎖，第二版短鎖，第三版長鎖。這裡最重要的是弄清楚**正確性和效能是兩個不同的判斷**。


## 為什麼 `counter++` 會出錯

它在概念上包含讀、加一、寫回。如果 A、B 都讀到 5，各自計算 6，又各自寫回 6，原本應增加兩次卻只增加一次。這叫 lost update（遺失更新）。在 C 語言記憶體模型中，沒有同步地同時讀寫共享非原子變數會造成 **data race／未定義行為**；不能把「偶爾剛好等於 40000」當作程式正確。

官方示範刻意把操作拆開，方便看 race；**`volatile` 不能代替同步**。

### 我只把讀取鎖住，不就安全了？

不行。假設有兩條 Thread 共用 `counter`，程式把讀取放進鎖裡，讀完就解鎖，最後才寫回：

```c
pthread_spin_lock(&lock);
long old = counter;
pthread_spin_unlock(&lock);

counter = old + 1;  // 寫回沒有受到鎖保護：錯誤示範
```

A、B 仍可能都讀到 `counter = 10`，最後各自寫回 11，造成更新遺失。更重要的是，在 C 裡，這種沒有正確同步的共享變數存取可能構成 Data Race，屬於未定義行為，不能只用少算幾次來描述所有後果。

**必須保護整個「讀取 → 修改 → 寫回」流程**；只鎖讀取、只鎖寫回，或分成兩次不同的鎖，都不能自然保證整次更新具有原子性。

```c
pthread_spin_lock(&lock);
counter++;
pthread_spin_unlock(&lock);
```

這裡的 `counter++` 是示意：所有會接觸相同共享狀態的程式路徑，都要遵守一致的同步規則。

來源：<https://en.cppreference.com/c/language/memory_model>。

### 某次剛好算對，不代表沒有資料競爭

如果系統只有一個 CPU 核心，兩條 Thread 通常輪流獲得執行時間，某次執行可能剛好沒有在 `counter++` 中途切換，所以最後得到預期結果。

但這**不代表沒有鎖就安全**。同一核心也會發生執行緒切換；下一次、不同最佳化設定或不同執行時間，都可能讓原本的問題出現。C 對未同步的衝突存取有 Data Race 規則，結果碰巧正確也不能證明程式符合規則。

所以要先確認每條存取路徑都有正確同步，然後才比較執行時間。這是「結果正確」和「程式本身正確」的差別。

## 短鎖與長鎖

```c
// work() 不需要碰共享 counter，就先在鎖外完成。
uint32_t local = work(i);
pthread_spin_lock(&lock);
counter++;
pthread_spin_unlock(&lock);
```

相反地，如果把耗時的 `work(i)` 放進 lock 裡，另一個 worker 就得一直等，可能讓兩個 worker 幾乎輪流執行。短鎖版本與長鎖版本都可能得到 40000，但長鎖版本通常花更多等待成本。

**注意：** 這個代碼片段只展示原理；`counter++` 受同一鎖完整保護才有意義。官方 Demo 還用到 `sink` 這類共享變數；做正式程式的正確性分析時，必須逐一確認它們是否也有資料競爭。原始示例不等於可直接當正式產品的同步範本。

## 什麼時候改用 Mutex、Atomic？

- **Mutex：** 如果臨界區可能有較長等待，會讓執行緒阻塞睡眠，通常比一直忙等更合適；但具體取決於平台實作。
- **Spinlock：** 等待期間持續佔 CPU。只有持鎖極短、核心資源充足、沒有阻塞作業時才值得評估。考試若把 CPU 使用率列入評分，尤其不要只看總時間。
- **Atomic：** 對單一獨立計數器可能能避免互斥鎖，但如果多個欄位必須一起更新，原子化單一欄位不能保證整體一致性。
- **Thread-local + merge：** 各 worker 累積自己的數值，最後合併，減少頻繁爭同一把鎖；但需要更多記憶體，且會改變中途讀取結果的時間點。

## 怎麼測

```bash
cd /demo/section2-3
make run-critical-section
```

記錄三種版本的 counter 值、執行時間、CPU 使用率，重複多次；**正確值 40000 是第一門檻**。不能只拿其中一次時間作結論。變更鎖的範圍時，確認鎖外運算是否真的只用區域資料、共享狀態不會被別的執行緒修改。

來源：[POSIX pthread API](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutex_lock.html)、[C memory model](https://en.cppreference.com/w/c/language/memory_model.html)。
