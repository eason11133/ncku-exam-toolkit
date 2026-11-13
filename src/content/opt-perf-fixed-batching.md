---
id: opt-perf-fixed-batching
title: Batch 到底快在哪？從逐筆處理到正確分批
category: Performance Engineering
tags: Performance Engineering, perf-batch-vs-realtime, batch, throughput, latency
aliases: opt-perf-fixed-batching, 固定批次, 批次處理
priority: P0
difficulty: intermediate
source_type: personal
source_url: https://docs.python.org/3/library/itertools.html
verified: false
updated_at: 2026-11-13
summary: 用具體資料比較逐筆與分批的呼叫次數，處理尾批、延遲、重試與容量問題。
related: ncku-v2-perf-batch-vs-realtime, ncku-performance-benchmark
---

# Batch 到底快在哪？

想像你要寄出 10 件貨。每寄一件都要重新填單、排隊、付款，就會有 10 次固定手續。如果物流允許一次收 4 件，可能只要排隊 3 次。**Batch 節省的是重複做的固定工作，不保證每一件貨處理本身會更快。**

程式也一樣。假設每次呼叫 `send()` 都有固定啟動成本：

- 逐筆送 10 筆：呼叫 10 次。
- 每 4 筆送一次：第一批 4 筆、第二批 4 筆、最後 2 筆，共呼叫 3 次。
- 最後 2 筆仍然要送出。漏掉尾批就是資料遺失，不能算優化。

## 先追一遍資料

輸入是 `0,1,2,3,4,5,6,7,8,9`，每批最多 4 筆。

| 第幾次送出 | 內容 | 送出後累計筆數 |
|---|---|---:|
| 1 | `[0,1,2,3]` | 4 |
| 2 | `[4,5,6,7]` | 8 |
| 3 | `[8,9]` | 10 |

分批前後，**總筆數、順序及每筆的內容必須一樣**。這裡只是將呼叫次數從 10 降到 3，沒有任何實測數據能證明延遲或吞吐一定改善。

## Python 完整範例（可以直接執行）

<!-- test: full-python -->
```python
from itertools import chain
from random import Random


def chunked(items, batch_size):
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) == batch_size:
            yield batch
            batch = []
    if batch:  # 尾批即使不足 batch_size 也要送出
        yield batch


def test_chunked():
    assert list(chunked([], 4)) == []
    assert list(chunked([10, 20], 4)) == [[10, 20]]
    assert list(chunked(range(8), 4)) == [[0, 1, 2, 3], [4, 5, 6, 7]]
    assert list(chunked(range(10), 4))[-1] == [8, 9]
    try:
        list(chunked([1], 0))
        raise AssertionError("batch_size=0 should fail")
    except ValueError:
        pass

    rng = Random(42)
    for _ in range(500):
        n = rng.randrange(0, 120)
        size = rng.randrange(1, 40)
        data = [rng.randrange(-3, 4) for _ in range(n)]  # 含重複與負數
        batches = list(chunked(data, size))
        assert list(chain.from_iterable(batches)) == data
        assert all(1 <= len(b) <= size for b in batches)
        assert len(batches) == (n + size - 1) // size


test_chunked()
print([len(b) for b in chunked(range(10), 4)])  # [4, 4, 2]
```

`yield` 的意思是「這一批好了，先交給呼叫端，下一次再繼續跑」。如果你熟悉 `return`，它們差在：`return` 結束整個函式；`yield` 會保留迴圈位置，讓下一次迭代接著做。這個函式的**額外批次暫存空間**約為 `O(batch_size)`，不把所有輸入批次一次存起來；但如果呼叫端寫 `list(chunked(...))`，還是會把所有批次收集成 `O(n)` 空間。

## Batch 並沒有解決哪些問題？

**第一個是延遲。** 第 1 筆進來時，如果系統要湊足 4 筆才送，它就得等其他 3 筆。沒有新資料時可能一直等，所以即時串流還要設「最多等多久就送出」，並在結束時 flush。上面示範的是**有限輸入清單**，不是完整的串流計時實作。

**第二個是錯誤重試。** 若一批 4 筆送出後，伺服器已經收到了，但本機沒收到回覆，你再整批重送可能造成重複。需要依題目決定是否有唯一 ID、去重或可安全重試的設計。這不能靠分批函式自動解決。

**第三個是順序與記憶體。** 如果改成多條 Worker 同時處理不同批次，先送的批次不一定先完成；Batch 太大又可能超出接收端大小限制。

## 複雜度與效能怎麼判斷

- 把所有資料分成批次，仍然要讀每個元素，時間是 `O(n)`。
- 單看固定的 `send()` 呼叫次數，從 `n` 次變成約 `ceil(n / batch_size)` 次。前提是每次呼叫可傳多筆。
- 速度能不能變快，取決於啟動成本、每筆成本、接收端限制、等待時間及實際負載。**沒有量測就不能寫「快了 X%」。**

## 考場遇到變形題

如果題目要求「每一筆到達後 10 ms 內回應」，你不能單純說把 batch_size 增大。如果它要求「所有資料必須保留原順序且不可重複」，就要額外處理多 Worker 的完成順序和重試語意。

動手檢查三件事：**結果有沒有少或重複、尾批有沒有送出、原先的延遲要求是否被破壞。** 確認這三件事後，才比較相同負載的吞吐、p50/p95、記憶體。

**驗證狀態：** 上方 Python 是可以獨立執行的完整測試；尚未在 ROS 2 或正式考場測出任何效能改善。

來源：Python `itertools` 文件：https://docs.python.org/3/library/itertools.html
