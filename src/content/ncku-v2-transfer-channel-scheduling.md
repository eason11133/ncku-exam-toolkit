---
id: ncku-v2-transfer-channel-scheduling
title: Transfer Channel 佔用與資源回收
category: DMA
tags: channel, claim, release, resource, engine
aliases: channel,claim,release,resource,engine
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: No channel 或工作忽然不動，先檢查 claim、start、wait、release。
related: 
priority: P0
difficulty: intermediate
---

# Transfer Channel 佔用與資源回收

## 遇到什麼情況要查這篇

No channel 或工作忽然不動，先檢查 claim、start、wait、release。

## 先理解瓶頸

官方 Demo 模擬四個通道，通常需要先 claim 再 configure，完成後 release。若失敗分支提前 return 而沒有釋放，後面看起來就像「越跑越慢／沒有資源」。真正硬體通道數以晶片為準。

## 具體修改／排查示例

```c
int ch = engine_claim();
if (ch < 0) { /* 報告資源不足，不能繼續用 ch */ }
else {
    engine_configure(ch, &job);
    engine_start(ch);
    engine_wait(ch);
    engine_release(ch);
}
// 若設計有錯誤回傳，所有錯誤分支也要清理
```

## 可以嘗試的方案

### 1. 集中管理通道生命週期

**做法**：讓 claim 和 release 成對出現。

**先檢查**：程式可重整資源流程。

**可能的代價**：需處理所有錯誤路徑。

**要保留**：無資源洩漏。

### 2. 避免無意義的並行 channel

**做法**：按負載排程而非盲目佔滿。

**先檢查**：傳輸可排隊。

**可能的代價**：可能延遲個別任務。

**要保留**：輸出順序一致。

### 3. 加入資源不足的回退機制

**做法**：不能 claim 時等待或改 CPU copy。

**先檢查**：有可接受的替代路徑。

**可能的代價**：CPU 負載可能增加。

**要保留**：結果相同。

## 具體驗證流程

在循環測試反覆 claim/start/wait/release，確認每輪結束可 claim；加上資源不足、配置錯誤和中途取消情境。對照記錄同時 active channel 數。

## 什麼情況不該用

官方 Demo 有些 API 遇到錯誤直接 exit，未必能在同進程內做錯誤恢復；需區分它的設計與真實硬體 driver。

## 參考與查證狀態

- 參考：[Raspberry Pi Pico SDK DMA](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)
