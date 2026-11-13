---
id: opt-ros2-param-matrix
title: 參數實驗要固定工作量，不能只記最快一次
category: ROS 2
tags: ROS 2, ros2-parameters-config, 考場判讀
aliases: opt-ros2-param-matrix, 參數實驗要固定工作量，不能只記最快一次
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html
verified: false
updated_at: 2026-11-13
summary: 先通過正確性，再比較批次大小與延遲分布。
related: ncku-v2-ros2-parameters-config
---

# 參數實驗要固定工作量，不能只記最快一次

## 測試設計

用固定訊息集重播 `batch_size = 8 / 16 / 32`。對每組記錄重複執行、總處理訊息數、丟失筆數、吞吐量、p50/p95、記憶體與 CPU。若 batch size 改了需要等待更多資料，尾端延遲可能增加，不能只看吞吐量。

## 純 Python 的統計核對（可執行；不是 ROS 2 實測）

<!-- test: full-python -->
```python
from statistics import median
runs = {8:[10,12,11], 16:[8,9,9], 32:[7,8,10]}
for size, ms in sorted(runs.items()):
    if not (len(ms) == 3 and all(x > 0 for x in ms)):
        raise RuntimeError("check failed: opt-ros2-param-matrix")
    print(size, median(ms))
```

這三組數字**純為測試統計程式的示例，並非測得的 ROS 2 效能資料**。正式報告只能填自己的終端輸出，不能照抄。

## 對照判斷

- 任一版本輸出錯誤或有不允許的資料遺失，先判失敗，不參與速度勝負。
- 把可控範圍內每組資料都保留下來，不挑最好的一次。
- 若參數會在執行中改變，必須記錄生效時刻，否則不同樣本混在一起。

## 來源與驗證界線

- 參考：https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html
- `verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 深讀延伸｜把原理放進真實情境
## 參數測試不能只取「跑得最快的一次」

假設你要比較 `batch_size=4`、`8`、`16`。先固定消息總數、內容、發送頻率、接收端處理方式與同一台機器，否則大小批次的數字沒有可比性。每組先確認送出 N 筆後，收到的數量、順序和資料值符合需求；**沒有通過正確性，速度不算數**。

可以先用紙筆記錄每組三次延遲（下列數字純屬算例，**不是 ROS 2 實測**）：

| batch size | 延遲樣本（ms） | 中位數 |
|---|---|---:|
| 4 | 10, 11, 30 | 11 |
| 8 | 8, 9, 24 | 9 |
| 16 | 6, 12, 50 | 12 |

只挑最小的 `6 ms` 就會選 16，但三次中位數其實是 12。樣本只有三個，仍不足以對 p95 下穩定結論。要進一步看最大值、尾端延遲與吞吐量；當訊息必須即時回應時，大批次可能因為「等湊滿」而讓第一筆等更久。

ROS 2 `ros2 param set` 成功不代表程式馬上改用新值。若 Node 只在 `__init__` 讀一次，動態修改後也可能繼續用舊資料。測之前先記錄每組參數**何時被程式讀取**，必要時重啟 Node，才不會量到相同設定還以為做了 A/B。
