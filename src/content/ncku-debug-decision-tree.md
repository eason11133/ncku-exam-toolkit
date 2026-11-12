---
id: ncku-debug-decision-tree
title: 一頁排查：ROS 2、C、PIO、pthread、Transfer Engine
category: Debugging
tags: troubleshooting, ROS 2, compiler error, spinlock, DMA, PIO
aliases: 找不到資料, 編譯失敗, 漏資料, counter, 位元錯誤, 卡住
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/
verified: false
updated_at: 2026-11-12
summary: 面對陌生程式先依症狀縮小問題範圍，避免不清楚原因就要求 AI 重寫系統。
related: ncku-ros2-cli-workflow, ncku-pthread-critical-section, ncku-transfer-engine
---
# 先找症狀，再選下一個動作

## ROS 2 沒資料

```text
node 沒啟動 → 查執行視窗與 ros2 node list
node 有啟動 → ros2 node info 查發布／訂閱 Topic
Topic 不同 → 比對名稱
Topic 同、type 不同 → 修正 message type
名稱、type 同 → ros2 topic info -v 查 QoS
QoS 相容 → ros2 topic echo 原始／輸出 Topic，定位哪一段沒資料
```

不要只看到 `topic list` 有名字就認為通訊一定成功。

## C 編譯失敗

1. 找第一個真正的 `error:` 和檔案／行號，先不要被後面連鎖錯誤洗掉。
2. 看 `#include`、變數宣告、型別、函式原型、分號／大括號。
3. 若 `undefined reference`，多半進入**連結**階段，檢查 Makefile 是否包含必要 `.c`、是否用了 `-pthread` 等連結設定。
4. 若編譯成功卻結果錯，使用較小測資、警告旗標（例如 `-Wall -Wextra`）與適用的 sanitizer（環境允許時再用）。

## pthread 結果不正確或很慢

- 少算、值不固定 → 找共享變數的所有讀寫位置，分析 data race。
- 鎖後仍錯 → 可能有其他共享變數未被保護，或多個鎖無法保證同一操作的一致性。
- 正確但 CPU 很高 → 看是不是 spinlock 忙等。
- 正確但變慢 → 用計時找長 Critical Section、鎖內 I/O／昂貴工作。
- 永遠卡住 → 查死結：拿鎖順序、條件等待、Callback 同步呼叫。

## PIO Echo 沒回傳

- TX FIFO 是否寫入 word？
- PIO state machine 是否啟動？是否有 autopull／autopush 配置？
- `out x, 32` 與 `in x, 32` 的 shift 配置是否符合預期？
- RX FIFO 是否已滿而 `push` 卡住？CPU 是否讀取？
- 若操作實際腳位，檢查 pinmux、時鐘、PIO 程式與資料時序。**官方 Demo 只有閱讀範例，不需要開發板。**

## Transfer Engine 資料錯或越界

- `count` 是**筆數**還是 bytes？
- `size` 每筆 bytes，官方模擬引擎只支援 1、2、4。
- `count * size` 是否超過來源／目的 buffer 大小？
- `src_increment` / `dst_increment` 是否符合 Copy／Fill？
- 是否等待完成才讀結果？是否先 `engine_release`？
- 通道有沒有成功取得？是否有正確歸還？

## 每次更改都要確認

先輸出正確，再多次量測完成時間、CPU 與記憶體。假如改完結果變成 0、遺失訊息或跳過計算，速度再快都不算有效優化。
