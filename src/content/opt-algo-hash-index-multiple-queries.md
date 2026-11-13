---
id: opt-algo-hash-index-multiple-queries
title: 大量重複查詢，先建 Hash Index 再查
category: Algorithms
tags: Algorithms, algorithm-search-batching, 考場判讀
aliases: opt-algo-hash-index-multiple-queries, 大量重複查詢，先建 Hash Index 再查
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/bisect.html
verified: false
updated_at: 2026-11-13
summary: 查詢次數夠多才值得先建立 set/dict，並確認 Key 與重複值語意。
related: ncku-v2-algorithm-search-batching
---

# 大量重複查詢，先建 Hash Index 再查

## 什麼問題適合

固定一批 `records` 要回答上千次「是否存在」「用 Key 找資料」，每次線性掃描都要看 N 個元素。先建 `set` 或 `dict` 後查詢通常平均較快；但建立索引也要 O(N) 時間和額外記憶體。**如果只問一兩次，可能沒必要建索引。**

## 純 Python 完整示例

<!-- test: full-python -->
```python
records = [(11, "A"), (22, "B"), (11, "C")]
queries = [11, 33, 22]
# Key 重複時，這個版本刻意採「最後一筆覆蓋先前」的規則
by_key = {key: value for key, value in records}
assert by_key[11] == "C"
found = [by_key.get(q) for q in queries]
assert found == ["C", None, "B"]
print(found)
```

## 容易改壞答案的地方

這裡重複 Key 的策略是 **last wins**，不能當成所有題目都適用。如果題目要求找第一筆、全部匹配、依原輸入順序列出結果，必須用 `setdefault` 或 `dict[key] -> list` 等明確策略。字典 Key 必須可 Hash，且資料在建索引後若會更新，要處理同步更新或重建。

**驗收**：生成大量包含重複 Key 的資料，用線性掃描版（對應同樣重複規則）逐查比對輸出，再量建索引時間＋所有查詢總時間，而不是只量單筆 Hash 查詢。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/bisect.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 深讀延伸｜把原理放進真實情境
## `set`、`dict` 和「列表有沒有包含」其實是在回答不同題目

先拿 `[("A",10),("B",20),("A",30)]` 想一遍。`set` 很適合回答「A 這個 ID 出現過嗎」；`dict` 可以回答「A 現在對應哪個數值」，但用 `{k:v for k,v in rows}` 建 dict，重複的 A 會只留下最後一個 30。若題目要求**所有 A 的紀錄**或**最早出現的 A**，這種轉換就悄悄改了答案。

Python 裡用 `set` 或 `dict` 做平均 O(1) 查找，通常要先花 O(N) 來建索引，再做 Q 次查詢。當 Q 很小、N 也很小，維護索引不一定划算；當來源內容會更新，要想清楚何時重建／更新索引。`dict` 不是資料庫：它只反映你當時放進去的鍵值，不會自動感知原列表後來修改。

**自己改題：** 你原本要查「某 ID 是否存在」，後來改成「某 ID 出現幾次」。`set` 就不夠了，可以改用計數 dict；若要保留原始輸出順序，則應在原始查詢列表上逐一產生結果，而不是直接遍歷 set。
