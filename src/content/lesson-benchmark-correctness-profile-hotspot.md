---
id: lesson-benchmark-correctness-profile-hotspot
title: 先找最耗時的階段
category: Performance Engineering
tags: profiler, Benchmark／效能驗證, 效能優化
aliases: profile-hotspot, benchmark-correctness
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-12
summary: 用段落計時或 profiler 判斷 CPU/I/O/Lock/Memory 真瓶頸。
related: ncku-performance-benchmark
---

# 先找最耗時的階段

## 先弄懂這個問題

目前的方法是 **Benchmark／效能驗證**。先保留可以運作的版本，反覆量測，在相同輸入下比較輸出、耗時、CPU 和記憶體。

這個方案的目的是：優化主要瓶頸更有機會影響總耗時。

你可以先想像這個情境：程式慢，但不知道耗時集中在哪一段。

## 修改前：先看哪裡有問題

```python
result = parse(raw)
result = compute(result)
write_output(result)
```

## 修改後：對照實作

```python
from time import perf_counter
start = perf_counter()
result = parse(raw)
t1 = perf_counter()
result = compute(result)
t2 = perf_counter()
write_output(result)
t3 = perf_counter()
print("parse,compute,write(ms)",*(round(x*1e3,2) for x in
    (t1-start,t2-t1,t3-t2)))
```

## 逐步理解，為什麼這樣改

先量出熱點再決定優化位置。若 90% 時間在 `compute`，只優化 `write_output` 通常不會有大幅成果。埋點有成本，短流程要多次累積量測。

## 什麼情況才適合

- 可安插計時且知道預期輸出
- 避免因 log 造成明顯負擔

## 常見錯誤與代價

- 測量也有 overhead
- 不同測試負載瓶頸可能不同

**正確性界線：** 分段加總與端到端用不同指標檢查。

## 怎麼做測試

對代表性輸入量多次，估計每段占比；只有當正確性一致才採納優化。

優先觀察：phase time、總耗時、CPU。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **benchmark unreliable** 或 **單次數據不穩** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [Python perf_counter](https://docs.python.org/3/library/time.html)
