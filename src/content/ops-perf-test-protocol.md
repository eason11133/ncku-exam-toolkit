---
id: ops-perf-test-protocol
title: 優化前後的正確性與測試：Baseline → 改動 → 比較
category: 操作與除錯
tags: correctness,baseline,benchmark,diff,regression
aliases: 測資,結果比較,答案錯,效能比對,測試基準
difficulty: beginner
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/time.html#time.perf_counter
verified: false
updated_at: 2026-11-13
summary: 讓速度變快但結果錯的方案被立即拒絕，並保留可回退的版本。
related: ops-perf-cpu-memory,ops-code-change-audit
---

# 考試型優化先求「沒有改壞」

一個可用的流程：建立正確性檢查 → 記錄 Baseline → 找瓶頸 → 只做一項修改 → 重跑相同測試 → 比較 → 保留或還原。不能改成輸出空資料、跳過工作或少算就說比較快。

## 最小正確性檢查

```bash
# 同一份輸入、同一版本執行；檔名以題目為準
./app < sample.in > output.txt
# 有官方 expected.txt 才比較：
diff -u expected.txt output.txt
```

`diff` 成功退出（通常返回 0）表示兩份檔案內容一致；這只代表**該測資**通過，不代表所有邊界都正確。若沒有 `expected.txt`，不要自己捏造預期輸出。

## 記錄每次修改

| 版本 | 改動 | 測資 | 正確性 | Wall time | CPU | 記憶體 |
|---|---|---|---|---|---|---|
| baseline | 無 | 相同輸入 | 自行驗證 | 實測填入 | 實測 | 實測 |
| candidate | 一項修改 | 相同輸入 | 自行驗證 | 實測填入 | 實測 | 實測 |

**不要事先填任何『加速 30%』之類的數字。** 若結果波動很大，應多跑幾次，報告範圍、median 與測試條件；若測試規定不允許重複，明確標示限制。

## 最常見的假改善

- 改少輸出但破壞題目輸出格式。
- 調低工作次數或丟掉資料，讓程式不再完成同樣任務。
- 在比較組用了不同的編譯旗標或輸入規模。
- 只讀平均值，忽略卡住、錯誤率與尾端延遲。

參考：[Python `perf_counter`](https://docs.python.org/3/library/time.html#time.perf_counter)、[GCC Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html)。

## 延伸推演｜遇到變形題怎麼判斷

## 為什麼 Baseline 不能只留一張速度截圖？

假設修改前輸入 1,000 筆，修改後不小心只處理 950 筆；兩個版本都印 `OK`，但結果數量不同。要保留能重跑的測資檔，記錄程式版本、編譯旗標、輸出值／雜湊、退出碼，再看時間。**正確性是第一道門**，通過後才做多次量測。

分離三個成本：建置時間、啟動時間、實際執行時間。如果考場評分包含編譯，就不能拿只測迴圈的時間宣稱總體改善。再分清冷啟動和暖機後的結果：快取、分配器及背景負載會影響觀測值。

測試紀錄不要只存「最快 5.4 ms」，應留完整樣本數、量測方法、中位數、p95 計算規則和異常值。若版本 B 比 A 快但輸出排序不符規格，仍應退回 A 或修好 B 後重測。
