---
id: opt-perf-link-slow-events
title: 追 p95 大值時把慢事件連回 request ID
category: Performance Engineering
tags: Performance Engineering, perf-tail-latency, 考場判讀
aliases: opt-perf-link-slow-events, 追 p95 大值時把慢事件連回 request ID
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html
verified: false
updated_at: 2026-11-13
summary: 單看統計數字不知道慢在哪一段；需對應輸入與時間戳。
related: ncku-v2-perf-tail-latency
---

# 追 p95 大值時把慢事件連回 request ID

## 先留證據

只知道 `p95=500ms` 無法直接判斷是 GC、磁碟讀取、callback 卡住或 Queue 排隊。替每個工作記下 ID、入列時間、開始處理、完成時間，才有可能定位慢尾。記錄本身會有成本，要避免每個極短 callback 都做大量同步日誌。

<!-- test: full-python -->
```python
jobs = [
  {'id':'a','arrive':0,'start':2,'finish':5},
  {'id':'b','arrive':1,'start':3,'finish':20},
  {'id':'c','arrive':2,'start':8,'finish':9},
]
for j in jobs:
    j['queue_ms']=j['start']-j['arrive']
    j['process_ms']=j['finish']-j['start']
    j['total_ms']=j['finish']-j['arrive']
slow=max(jobs,key=lambda x:x['total_ms'])
if not (slow['id']=='b' and slow['process_ms']==17):
    raise RuntimeError("check failed: opt-perf-link-slow-events")
print(slow)
```

這是**人工資料分析示例**，不是真實 ROS 2 latency。分段時間要使用適合的單調時鐘，不可把不同電腦未同步的 wall clock 相減。必要時再加入 trace／profiler，但應記錄 Instrumentation overhead。

**驗收**：每筆 `total >= 0`、時間戳順序一致、成功／失敗／timeout 分類；壓測後抽出最慢的 ID 和輸入，嘗試重現原因。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/time.html
- 完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。

## 延伸推演｜遇到變形題怎麼判斷

## p95 慢的時候，先找到是哪一筆工作

只記一個 `p95=200 ms` 無法知道是哪個階段慢。應為每筆處理記一個可對應的 ID，保存開始、排隊、執行、完成時間，才能追到延遲尖峰發生在哪裡。若整條管線使用不同時鐘、不同主機，先確認時間基準可比較；不同機器的 wall clock 不一定同步。

假設一筆請求排隊 180 ms、計算 20 ms，單看總延遲 200 ms 會以為演算法很慢。真正瓶頸是前段排隊。反過來，若排隊 1 ms、計算 199 ms，才值得深入查計算函式與資源用量。

記錄也有成本：不要在熱路徑每筆都印大量文字到終端機；可先採小比例抽樣或收集數值，再核對抽樣是否偏向特定類型。**變形：** 有些處理失敗的請求被排除在時間統計外，p95 看似改善，卻只是慢請求失敗了。正確率必須跟延遲一起看。
