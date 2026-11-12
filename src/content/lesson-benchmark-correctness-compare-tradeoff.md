---
id: lesson-benchmark-correctness-compare-tradeoff
title: 同時比較時間、CPU、記憶體
category: Performance Engineering
tags: profiler, Benchmark／效能驗證, 效能優化
aliases: compare-tradeoff, benchmark-correctness
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-12
summary: 不把單一指標改善當成整體勝利。
related: ncku-performance-benchmark
---

# 同時比較時間、CPU、記憶體

## 先弄懂這個問題

目前的方法是 **Benchmark／效能驗證**。先保留可以運作的版本，反覆量測，在相同輸入下比較輸出、耗時、CPU 和記憶體。

這個方案的目的是：Spinlock 可能降低延遲卻增加 CPU；減少記憶體複製也可能讓同步更複雜。

你可以先想像這個情境：新版平均更快，但 RAM 增加兩倍，或 p95 變得更差。

## 修改前：先看哪裡有問題

```python
# 只比較平均耗時 (ms)
print("avg", sum(times) / len(times))
```

## 修改後：對照實作

```python
import statistics
ordered = sorted(times)
p95 = ordered[max(0, (95*len(ordered)+99)//100 - 1)]
print("median", statistics.median(times), "p95", p95)
print("peak_ram_mb", measured_peak_ram_mb)  # 需另行實測
```

## 逐步理解，為什麼這樣改

除了平均，還要看尾端延遲、吞吐、CPU、記憶體及輸出正確性。此處 p95 採 nearest-rank 定義，其他工具可能用插值所以數字略有差異；`measured_peak_ram_mb` 要由系統量測取得。

## 什麼情況才適合

- 明確評分／功能條件
- 有相同測試資料

## 常見錯誤與代價

- 需要多次測試
- 有時需要用更多記憶體換時間

**正確性界線：** 測試資料量、誤差及未測條件要寫清楚。

## 怎麼做測試

在相同輸入、相同硬體重複測 baseline 和新版，記錄 p50/p95、RAM、CPU 及錯誤數。

優先觀察：正確性、完成時間、CPU、RSS。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **benchmark unreliable** 或 **單次數據不穩** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Python perf_counter](https://docs.python.org/3/library/time.html)
