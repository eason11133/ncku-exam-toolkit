---
id: opt-stream-lru-cache
title: LRU Cache：純函式、資料版本與失效條件
category: Performance Engineering
tags: python, lru_cache, memoization, invalidation
aliases: opt-stream-lru-cache, LRU Cache
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/functools.html#functools.lru_cache
verified: false
updated_at: 2026-11-13
summary: 重複且穩定的查詢可記憶化，但輸入變化、資料更新和副作用會讓快取結果錯誤。
related: ncku-incremental-cache
---

# 快取不是所有重複呼叫都能加速

同一個輸入每次都算出相同結果，才有機會利用 `@lru_cache(maxsize=...)`。它用參數當 key，所以必須可 hash；如果計算依賴檔案內容、外部設定或時間，**只看函式參數可能不足以代表結果版本**。

```python
from functools import lru_cache

@lru_cache(maxsize=8)
def triangular(n, version):
    if n < 0:
        raise ValueError('n must be nonnegative')
    return n * (n + 1) // 2 + version

if not (triangular(9, 0) == 45):
    raise RuntimeError("example check failed")
if not (triangular(9, 0) == 45):
    raise RuntimeError("example check failed")
if not (triangular.cache_info().hits >= 1):
    raise RuntimeError("example check failed")
if not (triangular(9, 1) == 46):
    raise RuntimeError("example check failed")
triangular.cache_clear()
if not (triangular.cache_info().currsize == 0):
    raise RuntimeError("example check failed")
print('lru=ok')
```

這裡 `version` 是示意。若真正計算依賴資料庫或設定，務必在 key 中帶入可靠的資料版本，或者資料更新時 `cache_clear()`。`lru_cache` 保存回傳物件參照；如果你把可變 list 回傳後讓呼叫者直接修改，下次會取到被修改的舊物件，不能當成安全快取。

## 代價和測法

`maxsize=128` 最多保留最近的 128 組參數結果，不是 128 bytes。快取還會占記憶體，資料變動多、命中率低可能得不償失。用 `cache_info()` 看 hits/misses，再測總耗時、常駐記憶體，以及有／沒有快取的輸出完全一致。

**常見錯誤**：拿現在時間、亂數、網路回應等非純函式直接做快取；把 `@lru_cache` 用在會修改全域狀態的函式；忘記更新失效條件。執行緒環境下快取資料結構雖有同步措施，尚未快取的同一運算仍可能被多執行緒重複執行，不能把它當成業務鎖。

## 驗收範圍與限制

測資料版本變更後結果仍更新、maxsize 上限、快取中的可變回傳值及清除流程。這個範例只使用不可變整數結果。

## 延伸推演｜遇到變形題怎麼判斷

## Cache 的答案什麼時候會過期？

假設 `price(product_id)` 背後會讀每日更新的價目表，今天對 ID=7 查到 100。若直接加 `@lru_cache(maxsize=128)`，明天價錢變成 120，卻還可能回傳昨天的 100。LRU 只管理「誰比較久沒被用」，**不是自動知道資料已更新**。

LRU 比較適合輸入相同、結果也穩定的純函式，或有明確失效規則的運算。例如計算沒有副作用的數學函式能用 Cache；查即時狀態則可能要把版本號放進 key、設定生命週期或在資料更新時清除。

Cache 還會使用記憶體，第一次查詢也要付出存入成本；如果幾乎不會有重複 key，Hit Rate 很低，結果可能沒有加速。測試要比較開關 Cache 後的輸出、命中率、記憶體與總時間，包含資料版本變更的案例。
