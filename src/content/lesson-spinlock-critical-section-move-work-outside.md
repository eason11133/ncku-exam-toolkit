---
id: lesson-spinlock-critical-section-move-work-outside
title: 縮短 Critical Section
category: Concurrency
tags: pthread_spin_lock, pthread Spinlock／Critical Section, 效能優化
aliases: move-work-outside, spinlock-critical-section
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_spin_lock.html
verified: false
updated_at: 2026-11-12
summary: 能移出的局部計算先做，只保留必要共享更新在鎖內。
related: ncku-pthread-critical-section
---

# 縮短 Critical Section

## 先弄懂這個問題

目前的方法是 **pthread Spinlock／Critical Section**。鎖保護共享變數，持鎖過久會使其他執行緒忙等。

這個方案的目的是：讓共享資料的原子更新時間短，減少其他執行緒等待。

你可以先想像這個情境：四個 worker 都要加總成績，卻在同一把鎖內做大量計算。

## 修改前：先看哪裡有問題

```c
pthread_spin_lock(&lock);
int score = calculate_score(input); // 耗時，卻不必共享
shared_total += score;
pthread_spin_unlock(&lock);
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```c
int score = calculate_score(input);  // 每條 thread 自己算
pthread_spin_lock(&lock);
shared_total += score;                // 只保護共享變數
pthread_spin_unlock(&lock);
```

## 逐步理解，為什麼這樣改

`calculate_score` 若只讀自己的輸入，搬到鎖外仍可得相同結果。保護的是 `shared_total += score` 的讀取、加法與寫回，不是整個函式。若計算過程會讀寫共享狀態，不能直接搬出。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 工作不依賴鎖內瞬間狀態
- 同一批共享資料全部被一致保護

## 常見錯誤與代價

- 拆開可能破壞交易原子性
- 鎖外的其他共享變數也要分析資料競爭

**正確性界線：**正確性優先：counter 應完整、sink 等其他共享狀態也要排查。

## 怎麼做測試

固定相同輸入與 thread 數，先檢查總和一致，再比較鎖等待時間和總耗時；`calculate_score` 若有共享副作用，先處理同步。

優先觀察：counter、總耗時、CPU。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **counter lost update** 或 **共享 counter 讀寫競爭** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [POSIX pthread_spin_lock](https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_spin_lock.html)
- [C memory model](https://en.cppreference.com/w/c/language/memory_model.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
