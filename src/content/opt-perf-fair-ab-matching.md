---
id: opt-perf-fair-ab-matching
title: A/B 效能比較：先確保兩邊算的是同一份工作
category: Performance Engineering
tags: Performance Engineering, perf-tail-latency, 考場判讀
aliases: opt-perf-fair-ab-matching, A/B 效能比較：先確保兩邊算的是同一份工作
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/statistics.html
verified: false
updated_at: 2026-11-13
summary: 錯誤版本跑得快不能算優化；A/B 需相同工作量、輸入與測試環境。
related: ncku-v2-perf-tail-latency
---

# A/B 效能比較：先確保兩邊算的是同一份工作

## 比較前先核對

版本 A 處理 1000 筆、版本 B 只處理 800 筆，B 的時間再短也不能稱為提升效能。必須先確認結果值、筆數、順序（若要求）、錯誤率都符合規格；再用同一硬體、負載和相近環境重複跑。

## 純 Python 統計（示意數據）

<!-- test: full-python -->
```python
from statistics import median
baseline=[12,11,10,13,12]
candidate=[10,9,11,10,10]
assert len(baseline)==len(candidate)
assert all(t>0 for t in baseline+candidate)
med_a,med_b=median(baseline),median(candidate)
assert med_a==12 and med_b==10
ratio=med_a/med_b
print('baseline',med_a,'candidate',med_b,'ratio',ratio)
```

這些是**假設資料，沒有實際效能改善證據**。如果實際系統有冷啟動、CPU 頻率升降、檔案 Cache 或背景服務，A/B 執行順序也可能造成偏差；可以交錯重複執行、記錄環境與各次資料。

**驗收**：所有樣本的版本／commit／輸入雜湊與工作量一致，輸出先通過回歸測試；失敗或掉資料的版本標為 `INVALID`，不能被選成優化基準。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/statistics.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 多做一個「結果不對就拒絕比較」的檢查

假設 A 版本算 1000 筆要 20ms；B 只算 800 筆要 15ms。直接比 `20/15` 得到 1.33，會讓你以為 B 加速 33%，但 B 少做了 200 筆，根本不符合相同工作量。

<!-- v7-test: full-python -->
```python
from statistics import median

def compare(a, b):
    # a,b: (正確筆數, 期望筆數, 耗時樣本)
    for ok, expected, times in (a, b):
        if ok != expected or not times or any(t <= 0 for t in times):
            return 'INVALID'
    if a[1] != b[1]:
        return 'INVALID'
    return median(a[2]) / median(b[2])

assert compare((1000,1000,[20,21,19]),(800,1000,[15,16,14])) == 'INVALID'
ratio=compare((1000,1000,[20,21,19]),(1000,1000,[18,19,17]))
assert abs(ratio-(20/18)) < 1e-12
print('example ratio (synthetic only)=',ratio)
```

這些數字完全是假設測資，僅示範**先正確，再計速**的判斷。實際系統還需要確認每個項目的內容、順序和錯誤處理都相同；即使筆數都一樣，也可能算錯答案。Benchmark 的「時間」也必須一致地包含輸入、初始化、計算與輸出。
