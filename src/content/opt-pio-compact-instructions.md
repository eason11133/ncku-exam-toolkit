---
id: opt-pio-compact-instructions
title: PIO 指令記憶體不夠時先確認能不能縮短程式
category: Embedded Systems
tags: Embedded Systems, pio-state-machine-limits, 考場判讀
aliases: opt-pio-compact-instructions, PIO 指令記憶體不夠時先確認能不能縮短程式
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: 消除重複指令可能節省位置，但不能破壞精確時序。
related: ncku-v2-pio-state-machine-limits
---

# PIO 指令記憶體不夠時先確認能不能縮短程式

## 為何不能只看指令數

PIO 的指令記憶體有上限；`set`、`jmp` 等指令、Side-set 與 Delay 會影響 GPIO/時序。把 3 條指令合併成 2 條不代表波形維持相同，因為指令執行週期、延遲槽、Wrap 和 Stall 都可能不同。

## 比較要同時看三種結果

```text
1. 機器碼中的 PIO instruction 數與位置
2. 每個輸出 bit / GPIO 邊緣的時間點（cycles）
3. 有沒有在 FIFO 空／滿、WAIT 條件下發生不同 Stall
```

純 Python 週期示意：

<!-- test: full-python -->
```python
# 假設沒有 stall，也沒有額外 side-set 限制
old = [(1,3),(1,0)]   # (基本週期, delay)
new = [(1,4)]         # 假設想合成單一指令
if not (sum(a+b for a,b in old)==5):
    raise RuntimeError("check failed: opt-pio-compact-instructions")
if not (sum(a+b for a,b in new)==5):
    raise RuntimeError("check failed: opt-pio-compact-instructions")
print('total cycles match, but pin transitions may differ')
```

**總週期相同仍不代表外部波形相同**，這段只做數字提醒，沒有宣稱合併後的 PIO 指令真的存在或可編譯。檢查 `.wrap`／`.wrap_target` 是標記而非額外指令；新的 Side-set 或 Delay 是否可以在 5-bit 欄位編碼內放得下。

**驗收**：先 PIOASM 編譯、比對 instruction memory，再在實機以邏輯分析儀核對原本與修改後的腳位時序和 FIFO 資料序列。

## 來源與驗證界線

- 參考：https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
- 完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。
## 深讀延伸｜把原理放進真實情境
## PIO 指令少一條，波形可能就變了

假設一個 PIO 迴圈有四條一般指令、每條執行一個狀態機週期，不計 Stall 與 Delay，整輪需要四個週期。你刪了一條看起來「沒用」的指令，迴圈可能就只剩三個週期；外部裝置看到的脈波頻率、位置可能改變，即使輸出 bit 值完全一樣也不算相容。

PIO 指令本身可能附帶 Delay Slot 或 Side-set，這些會影響時序和 GPIO 行為。不要在沒有看過整段 `.pio` 與狀態機設定前，擅自把 `nop` 刪掉；它可能是刻意等待外部裝置採樣。某些 `pull`／`push`／`wait` 也可能因 FIFO 狀態 Stall，單純把「指令條數 × 週期」當成實際耗時只適合**沒有 Stall 的理想推演**。

比對舊版與新版時請分三個層次：① 指令在相同輸入下得到相同資料值；② `wrap` 與條件跳轉仍按預期走；③ GPIO 的相位、時脈和邊緣時刻符合協定。只比對最終 word 並不能證明第三點。

**紙筆題：** 四條指令變三條且 Clock Divider 不變；資料一樣但輸出更快，算不算成功？如果協定有固定時間要求，就不能當作正確優化。實際波形需由 PIO 模擬或邏輯分析儀實測，本頁沒有做實機確認。
