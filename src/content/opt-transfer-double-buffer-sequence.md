---
id: opt-transfer-double-buffer-sequence
title: 雙 Buffer Pipeline：開始、等待、處理和重用的正確順序
category: Embedded Systems
tags: double buffer,transfer engine,ping pong,lifetime,async
aliases: double-buffer,pipeline,兩塊buffer,等待傳輸,非同步搬運
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: 用逐步事件順序說明如何讓搬運與計算重疊，並找出「尚未完成就重用」的錯誤。
related: opt-transfer-unit-capacity
priority: P0
difficulty: advanced
---

# 先搞清楚：哪個 Buffer 正在被誰使用

假設一份資料分成 A、B、C 三塊。單 Buffer 寫法是「傳 A → 等 A → 算 A → 傳 B → 等 B → 算 B」。如果搬運和計算可以彼此獨立，雙 Buffer 讓你在**算 A 的同時傳 B**，在算 B 的同時傳 C。但最多只準備兩塊空間，不代表可以在任何時間覆寫任一塊。

可以把每塊 Buffer 看成三種狀態：`FREE`（可寫入下一筆）、`TRANSFERRING`（引擎正在寫入，CPU 不可當作完成資料讀）、`READY/PROCESSING`（搬完，可由 CPU 處理）。狀態轉換必須靠**真正的完成通知或等待**；「已呼叫 start」不是完成。

## 時間順序（示意，不是可直接編譯的 C）

```text
起始：B0=FREE, B1=FREE
1. start_transfer(B0, A)  → B0=TRANSFERRING
2. wait(B0)               → B0=READY
3. start_transfer(B1, B)  → B1=TRANSFERRING
4. process(B0)            → 算 A，B 的搬運可同時進行
5. process 完成            → B0=FREE
6. wait(B1)               → B1=READY
7. start_transfer(B0, C)  → B0=TRANSFERRING
8. process(B1)            → 算 B，C 的搬運可同時進行
9. B1 完成後釋放，wait(B0)，process(B0) → 算 C
```

這裡的 `start_transfer`、`wait`、`process` 是**流程代稱**，不是官方 `engine.h` 裡的函式簽名。若使用官方 2-3 模擬程式，實際要對照 `engine_claim`、`engine_configure`、`engine_start`、`engine_wait`、`engine_release` 以及其限制；若使用真實 DMA，則需依硬體 SDK 設定通道及完成訊號。別把這段偽碼當可直接貼入 C 的版本。

## 最常見的三種失敗

**第一種：提前讀取。** `engine_start()` 回傳後就拿 `dst` 做 checksum；如果搬運仍進行，可能讀到舊值或混合資料。先等完成再讀。

**第二種：太早重用。** 某一塊還在傳資料，CPU 卻用它寫下一筆。來源／目的 Buffer 的讀寫擁有權要分開看：DMA 讀來源時，CPU 不能在搬完前改寫來源；DMA 寫目的時，CPU 不能把尚未完成的目的資料當結果。

**第三種：只等最後一次。** 迴圈退出時還有傳輸尚未完成，卻先釋放通道、Buffer 或直接 `return`。對每個已啟動工作，都要有完成或取消後安全清理的路徑。

## 怎麼測效能才不會測假改善

每塊加序號及 checksum，確認 A/B/C 各處理**一次且只一次**、順序符合需求。測 `chunks=0`、`1`、`2`、奇數塊、最後一塊未滿、搬運慢於計算、計算慢於搬運。比較**整批完成時間**，不只比較 `start_transfer` 很快就返回的耗時。

官方 Demo 用 pthread 模擬 Transfer Engine，搬運工作仍消耗 CPU。即使模擬測出重疊，也不能推論硬體 DMA 在 RP2350 上的耗電或 CPU 成本；硬體結果要另用實機驗證。
## 用四個時間段看出「重疊」到底省了什麼

假設每塊資料：搬運要 4 個時間單位，CPU 處理要 6 個。三塊資料依序叫 A、B、C。

單 Buffer 最直觀的流程是：A 搬 4 → A 算 6 → B 搬 4 → B 算 6 → C 搬 4 → C 算 6。總共 **30** 個時間單位。

若可以有兩個安全分離的 Buffer，且搬運與 CPU 計算確實能並行：A 先搬 4；接著 **算 A 的 6** 同時 **搬 B 的 4**；再算 B 的 6 同時搬 C 的 4；最後算 C 的 6。理想化總時間是 **22**。這不是實測速度，也忽略啟動成本、排程和等待延遲，目的是讓你看懂為什麼可能省時間。

### 真正會卡住的是最後一塊

如果最後只有 3 個元素，但你仍用 `count=100`，即使有雙 Buffer 也可能越界。每次傳輸前，都要把**本塊長度**和 `size` 算清楚，確認目的 Buffer 容量充足。空輸入 `chunks=0` 時不應對未初始化通道呼叫 `wait`；只有一塊時也不應假設必定要開第二條傳輸。

### Buffer 擁有權（誰現在可以動它？）

A 的資料正在由引擎寫入 B0 時，CPU 不能讀取 B0 的**未完成內容**。等待完成後才能開始 `process(B0)`；同時另一個 B1 可以接收下一塊。當 CPU 還沒處理完 B0，就不能把 B0 重新交給下一次傳輸覆寫。每塊 Buffer 的狀態必須單獨追蹤。

在 Linux pthread 模擬的 2-3 中，還要注意官方引擎自身的並行同步實作有教材用途上的限制。**讀懂流程**不代表它可作為 production-safe 的 DMA/Thread 庫。驗收時先看三塊資料是否都被處理一次，然後才比整批耗時。

---

## 深讀：兩塊 Buffer 的「使用權」要像鑰匙一樣交接

假設資料要分成三塊 A、B、C，Buffer 有 `buf0` 和 `buf1`。理想流程可以這樣安排：

| 時刻 | buf0 | buf1 | CPU 做什麼 |
|---|---|---|---|
| 1 | 正在傳 A | 空著 | 先確認 A 的傳輸已啟動 |
| 2 | A 完成、可讀 | 正在傳 B | CPU 處理 A |
| 3 | 正在傳 C | B 完成、可讀 | CPU 處理 B |
| 4 | C 完成、可讀 | 空著 | CPU 處理 C、等全部工作完成 |

重點不是一定得照這個時序跑，而是每一刻都滿足：

- DMA／模擬引擎**寫入**某塊 Buffer 時，CPU 不可把它當成完整新資料讀取。
- CPU 還在**處理**舊資料時，不可把同一塊 Buffer 提早交給下一次傳輸覆寫。
- 每一塊傳輸真正完成後，才可從「傳輸中」改成「可讀」；完成後還可能需要平台規定的記憶體同步。

常見錯誤是：`start(B)` 後馬上 `process(buf1)`，因為 `start` 可能是非同步的；你拿到的是「已開始」而非「資料已經就緒」。另一個錯誤是 A 還沒處理完就開始 C 寫 `buf0`，讓 CPU 看見一半 A、一半 C。

**最後一塊不足怎麼辦？** 假設 10 筆資料、每塊 4 筆，應依序是 4、4、2。最後一塊的 `count=2`（假設 size 定義為每筆大小），不能把舊 Buffer 的剩餘兩筆也當成新資料輸出。

本包 `quality_v9/examples/double_buffer_ownership.py` 是純狀態／切片模型，**不是**官方 Transfer Engine 的執行或真 DMA 速度測試。正式上機要對照 API 的 `claim → configure → start → wait → release`，並驗證每塊資料的生命週期。
