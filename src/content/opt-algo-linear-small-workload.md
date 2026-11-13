---
id: opt-algo-linear-small-workload
title: 資料小、查詢少時，線性掃描有時更合適
category: Algorithms
tags: Algorithms, algorithm-search-batching, 考場判讀
aliases: opt-algo-linear-small-workload, 資料小、查詢少時，線性掃描有時更合適
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/bisect.html
verified: false
updated_at: 2026-11-13
summary: 把預處理與維護成本一起算，避免小題過度設計。
related: ncku-v2-algorithm-search-batching
---

# 資料小、查詢少時，線性掃描有時更合適

## 為什麼 O(N) 不一定比較慢

要查 8 筆資料、總共兩次，先建 Hash Index 或排序可能比直接 `for` 還複雜。Big-O 描述資料量增大時的趨勢，不能直接拿它判斷這組小測資的真實耗時。維持簡單版本也有好處：輸入順序、第一筆符合、重複項目都比較直觀。

<!-- test: full-python -->
```python
values = [(3,"old"),(7,"ok"),(3,"new"),(9,"last")]
def first_match(key):
    for k, v in values:
        if k == key:
            return v
    return None
if not (first_match(3) == "old"):
    raise RuntimeError("check failed: opt-algo-linear-small-workload")
if not (first_match(7) == "ok"):
    raise RuntimeError("check failed: opt-algo-linear-small-workload")
if not (first_match(4) is None):
    raise RuntimeError("check failed: opt-algo-linear-small-workload")
print("linear-first-match ok")
```

若改成 `{k:v for k,v in values}`，重複 Key `3` 會變成 `"new"`，**功能就不同了**。性能升級前先定義重複鍵語意；若正式測資多次查詢，重新比較總時間再決定要不要換方法。

**驗收**：固定同一組包含重複鍵的輸入，測 N=0/1/少量與多次查詢，統計預處理＋查詢整段時間。不要只測成功查詢，查不到的情況可能需要掃完整份資料。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/bisect.html
- 完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 深讀延伸｜把原理放進真實情境
## 為什麼 O(N) 有時會贏 O(log N)？

想像只有 5 個分數 `[7, 3, 9, 3, 5]`，你只問一次「有沒有 9」。線性掃描最壞看 5 次；二分搜尋要先花時間排序。當資料很小、只查一兩次，額外排序、建立 Hash Index 的成本很可能不值得。時間複雜度比較的是**資料量變大時的成長方式**，不直接保證一個小輸入的毫秒數。

但若同樣 5 個值要查一百萬次，先轉成 `set` 可能就更有意義。把總工作拆開計算：線性掃描約 `Q × N` 次比較；排序後二分約 `N log N + Q log N`；建立 Hash 集合平均約 `N + Q`，但要額外記憶體，最壞情況也不保證 O(1)。

**自己推演：** 資料 `[3,3,5,7,9]`、查詢 3。`bisect_left` 回傳 0，`bisect_right` 回傳 2。若題目要的是「出現次數」，兩者相減才是 2；若要最左位置，只用 `bisect_left`，而且仍需檢查該位置是不是 3。不要因為二分傳回某個 index 就假設一定找到值。

若資料會頻繁新增、刪除，維護排序陣列也有搬移成本。不要寫成「排序一次後所有操作都是 O(log N)」；二分只保證搜尋位置的比較次數，list 中間插入仍可能要 O(N) 搬移。
