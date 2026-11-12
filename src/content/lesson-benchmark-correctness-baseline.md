---
id: lesson-benchmark-correctness-baseline
title: 先建立能重現的 Baseline
category: Performance Engineering
tags: profiler, Benchmark／效能驗證, 效能優化
aliases: baseline, benchmark-correctness
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-12
summary: 記錄輸入、版本、測試命令、正確輸出與多次執行時間。
related: ncku-performance-benchmark
---

# 先建立能重現的 Baseline

## 先弄懂這個問題

目前的方法是 **Benchmark／效能驗證**。先保留可以運作的版本，反覆量測，在相同輸入下比較輸出、耗時、CPU 和記憶體。

這個方案的目的是：沒有基準就無法判斷改動是否改善。

你可以先想像這個情境：修改程式後覺得變快，但沒有修改前的可重現數據。

## 修改前：先看哪裡有問題

```python
# 只有一次人工感覺：「這版好像比較快」
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```python
import statistics, time
samples = []
for _ in range(30):
    t0 = time.perf_counter()
    run_same_input()
    samples.append((time.perf_counter() - t0) * 1000)
print("median(ms)=", statistics.median(samples))
```

## 逐步理解，為什麼這樣改

Baseline 要固定輸入、平台、編譯選項、負載條件；多次重跑。`run_same_input` 是使用者需要替換的被測函式，且正式測試還要先暖機、檢查輸出。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 相同硬體與負載
- 測試命令完整

## 常見錯誤與代價

- 背景負載造成偏差
- 小樣本 p95 不穩定

**正確性界線：**先通過正確性再比效率；必要時可還原 baseline。

## 怎麼做測試

將輸入和環境寫在紀錄中；比較每次結果的分布，避免把單次偶然值當結論。

優先觀察：pass/fail、median、p95、CPU、RSS。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **benchmark unreliable** 或 **單次數據不穩** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Python perf_counter](https://docs.python.org/3/library/time.html)
- [Git Documentation](https://git-scm.com/docs)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
