---
id: opt-perf-nearest-rank-and-max
title: 平均值之外，要看 p95 與最大延遲
category: Performance Engineering
tags: Performance Engineering, perf-tail-latency, 考場判讀
aliases: opt-perf-nearest-rank-and-max, 平均值之外，要看 p95 與最大延遲
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/statistics.html
verified: false
updated_at: 2026-11-13
summary: 百分位數要標清算法和樣本數，別把平均當作慢尾。
related: ncku-v2-perf-tail-latency
---

# 平均值之外，要看 p95 與最大延遲

## 為什麼平均不夠

99 筆都快、1 筆等非常久，平均可能看不出使用者最差時的等待。p95 是把延遲由小到大排列後約 95% 樣本不超過的數值；不同軟體可能採 nearest-rank 或插值，因此必須**寫明算法**。

## 純 Python：nearest-rank 版

<!-- test: full-python -->
```python
import math
samples=[1,2,2,3,4,5,5,6,7,100]
def p95_nearest(xs):
    if not xs: raise ValueError("no samples")
    ordered=sorted(xs)
    idx=math.ceil(0.95*len(ordered))-1
    return ordered[idx]
if not (p95_nearest(samples)==100):
    raise RuntimeError("check failed: opt-perf-nearest-rank-and-max")
if not (max(samples)==100):
    raise RuntimeError("check failed: opt-perf-nearest-rank-and-max")
if not (round(sum(samples)/len(samples),1)==13.5):
    raise RuntimeError("check failed: opt-perf-nearest-rank-and-max")
print('avg',sum(samples)/len(samples),'p95',p95_nearest(samples))
```

10 筆樣本時 nearest-rank p95 取到第 10 筆（也就是最大值），代表**樣本很少、不夠穩定**，不能把這數字當成真實系統的長期 p95。這些數據都是示例，不是考場成績。

**驗收**：統一毫秒或微秒、同一計時範圍、相同測試數量；先移除或另標不合法樣本（例如 NaN、負耗時），不可把 timeout 當作成功的 0ms。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/statistics.html
- 完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 深讀延伸｜把原理放進真實情境
## 同一組資料，平均值會把慢的那筆藏起來

假設 10 次延遲是 `[2,2,2,2,2,2,2,2,2,30]` ms。平均是 `(9×2+30)/10=4.8 ms`，但有一筆真的等了 30 ms。若這是一個要快速回應的服務，使用者碰到最後一筆的感受不會等同 4.8 ms。

Nearest-rank p95 的算法：先排序，索引為 `ceil(0.95×N)-1`。N=10 時是 `ceil(9.5)-1=9`（0-based），所以 p95 為 30 ms。樣本很少時 p95 很容易受單筆極端值影響，**不能把十筆的 p95 當成長期穩定特性**。有些工具採線性插值，結果會不同，報告要明寫定義。

另一個容易混淆的地方是吞吐量。若 100 次測試每次要處理 100 個元素，你拿 100 次的測試時間算 `100/seconds`，單位是「次執行／秒」，不是「元素／秒」。要報後者必須乘上實際處理的元素數，且要確認每次都完整處理。

**小練習：** 對 `[1,1,1,1,100]` 算 median 和 nearest-rank p95。中位數是 1、p95 是 100；這兩個數字各自回答不同問題，沒有誰能代替誰。

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`nearest_rank_boundary.py`），與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。直接以 Python 3 執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```python
from math import ceil
from random import Random

def percentile_nearest_rank(values, p):
    if not values or not 0 < p <= 1:
        raise ValueError('need samples and 0 < p <= 1')
    return sorted(values)[ceil(p * len(values))-1]

if not (percentile_nearest_rank([2]*9 + [30], .95) == 30):
    raise RuntimeError("example check failed")
if not (percentile_nearest_rank([1,1,1,1,100], .95) == 100):
    raise RuntimeError("example check failed")
rng = Random(2026)
for size in range(1, 100):
    for _ in range(10):
        vals = [rng.randrange(0, 1000) for _ in range(size)]
        for p in (.01, .5, .95, 1.0):
            result = percentile_nearest_rank(vals,p)
            if not (result == sorted(vals)[ceil(p * size)-1]):
                raise RuntimeError("example check failed")
try:
    percentile_nearest_rank([], .95)
except ValueError:
    pass
else:
    raise RuntimeError('empty input must be rejected')
print('nearest rank boundary PASS')
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：p95 不是把全部時間平均

假設 20 次延遲排序後，前 19 次都是 10ms、最後一次是 500ms。平均是 34.5ms；採用 **nearest-rank** 定義，p95 的位置是 `ceil(0.95*20)=19`（1-based），所以 p95 是 10ms，最大值仍為 500ms。這告訴你 p95 有時**看不見最糟的一筆**，不能拿它取代 max。

若樣本只有 10 筆，同樣的 nearest-rank p95 位置是第 10 筆，此時 p95 恰好等於最大值。不同分析工具對 percentile 可能採**插值法**，因此報告必須註明算法、樣本數、單位及排序方式，不能把不同定義的 p95 當成完全相同。

**自己算一遍：** `[1,2,3,4,5,6,7,8,9,100]` 的 nearest-rank p95 為 100。改成 20 筆，只有最後一筆 100，nearest-rank p95 可能變成前一筆。任何一個百分位都不能保證涵蓋全部極端值，最後還是要保留正確性和超時事件。
