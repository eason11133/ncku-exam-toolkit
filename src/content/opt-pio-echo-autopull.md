---
id: opt-pio-echo-autopull
title: PIO Echo 實際資料路徑：OSR、X、ISR、FIFO 與阻塞點
category: Embedded Systems
tags: PIO,OSR,ISR,autopull,autopush,FIFO,Raspberry Pi
aliases: out x 32,in x 32,push,PIO echo,PIO shift,TX FIFO
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-13
summary: 嚴格對照官方 2-2 PIO 指令，分清隱式 autopull、顯式 push 和硬體 FIFO 等待。
related: opt-transfer-unit-capacity
priority: P0
difficulty: intermediate
---

# 這個 Demo 的 PIO 程式只有三條指令

官方 2-2 的 `demo_pio.pio` 使用：

```pio
.program echo
.wrap_target
    out x, 32
    in x, 32
    push
.wrap
```

官方前提是**OSR 已設定 autopull**，因此資料路徑應讀作：CPU 放資料到 **TX FIFO** → autopull 把 word 載入 **OSR** → `out x, 32` 取出 32 bits 到 **X** → `in x, 32` 放進 **ISR** → 顯式 `push` 將資料送到 **RX FIFO** → CPU 讀回。這段沒有寫 `mov`，也沒有顯式的 `pull` 指令；把教學寫成「執行 pull / mov / push」會和實際檔案對不起來。

`autopull` 也不是「每執行一條指令都自動取下一筆」。它與 OSR 移出的位數及閾值有關，還要配合 State Machine 設定；閾值與 Shift Direction 不清楚時不能先斷定字串會怎麼送出。這個 Echo 示例一次處理 32 bits，從讀程式的角度可以先理解為一個 word；更複雜的位元序列還要檢查移位方向。

## 哪裡可能卡住？

- TX FIFO 沒資料：需要新 word 的 PIO 執行會等待。
- RX FIFO 滿：顯式 `push` 若設定為阻塞式，可能等 CPU／DMA 把資料讀走。
- PIO State Machine 沒啟用、初始化順序不對：CPU 寫進 TX FIFO 不代表 PIO 已執行。
- 若同時開啟 autopush，需確認閾值與顯式 push 是否互相影響；不能照抄不同配置的範例而不檢查。

## 看 Pico SDK API 時先分清兩種寫入

`pio_sm_put_blocking()` 在 FIFO 滿時**會等待**；你在外面再寫 `while (pio_sm_is_tx_fifo_full(...))` 通常只會重複檢查，不能讓 State Machine 變快。`pio_sm_put()` 不會替你等待：若 FIFO 已滿，該次寫入可能不會進 FIFO。`pio_sm_get_blocking()` 在 RX FIFO 空時等待；普通 `pio_sm_get()` 不負責幫你等待資料。

這些 API 來自 Pico SDK，**不是官方 2-2 範例要求你在自己的電腦上直接編譯**。沒有 RP2350、Pico SDK 專案及正確配置時，這篇只做指令閱讀與風險判讀，不能把硬體行為說成已實測。

## 怎麼驗證資料沒有被吃掉？

先用 `0x00000000`、`0xFFFFFFFF`、`0xA5A5A5A5` 和交錯 bit 的固定資料。如果未來使用實機，確認數量、順序、每一個 bit 都一致；一筆未回來時分開查 TX 是否成功寫入、State Machine 是否執行、RX 是否可讀。若實際瓶頸是 PIO 指令週期或外部協定，換成 DMA 也不會直接提高該上限。

---

## 深讀：官方 Echo 的一個 32-bit Word，走了哪五個位置？

假設 CPU 送出 `0x12345678`，PIO Echo 的程式是：

```pio
.program echo
.wrap_target
    out x, 32
    in  x, 32
    push
.wrap
```

| 執行位置 | 發生的事 | 你該問的問題 |
|---|---|---|
| TX FIFO | CPU 放入一筆 32-bit word | FIFO 是否真的有資料？ |
| OSR | 依設定取得 word | 官方範例假設 **autopull 已配置** |
| `out x, 32` | 從 OSR 移出 32 bits 到 X | 位寬、shift 設定是否符合預期？ |
| `in x, 32` | 將 X 的 32 bits 移進 ISR | 是否意外啟用 autopush？ |
| `push` → RX FIFO | 把 ISR 的值送回接收 FIFO | RX FIFO 是否已滿、CPU 有沒有取？ |

看不見輸出時，**先看卡在哪一段**。如果 TX FIFO 是空的，`out` 可能等資料；如果 RX FIFO 已滿，`push` 可能無法前進。這不等於 C 程式中的 `printf` 壞掉。

**特別注意：** 這個官方版本使用**明確 `push`**，不要自己另外打開 autopush 再假裝與原本相同。Autopull 與 autopush 是兩套設定；不是「自動」兩字一樣就能互換。

### 如果 `out x, 32` 改成 `out x, 8` 呢？

一個 `out x, 8` 只消耗 8 bits；對 OSR 的剩餘 24 bits 怎麼處理，要看後續指令、移位方向與 autopull threshold。不能把「四次取 8 bits」直接判成「一定還是同一個原樣回送的 32-bit word」；還要決定每次的拼接順序，以及 ISR／push 的時機。

**練習：** 傳了三筆、卻只收到兩筆，最先查什麼？先查 CPU 是否真的送滿三筆、第三筆是否在 OSR／X／ISR、RX FIFO 有沒有被讀出，再查是否卡在 `push`。這是排查順序，不是說一定是 RX FIFO 出錯。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：跟著一個 word 走一遍，不要死背 PIO 指令

官方 Echo PIO 程式核心是三個指令：`out x, 32`、`in x, 32`、`push`。假設 CPU 送入 `0x12345678` 到 TX FIFO，且 State Machine 已設定符合此程式的 **autopull、shift direction 與閾值**。資料先由 TX FIFO 補進 OSR，`out x,32` 把 32 位移到 X，`in x,32` 從 X 取 32 位移進 ISR，`push` 才把 ISR 內容送到 RX FIFO。CPU 從 RX FIFO 取回資料，才能和原始 word 比對。

| 位置 | 此時裝什麼 | 哪個動作會讓它卡住 |
|---|---|---|
| TX FIFO | CPU 準備交給 PIO 的 word | CPU 寫得太快導致 FIFO 滿 |
| OSR | 等待 OUT 的位元 | 沒資料而 autopull 等待 |
| X | OUT 搬過來的暫存值 | 本身不是 CPU 可直接讀的 RX 結果 |
| ISR | IN 累積的位元 | 必須經 PUSH 才成為可取的 FIFO word |
| RX FIFO | CPU 可取的結果 | RX FIFO 滿，阻塞式 PUSH 停住 |

**容易混淆：** `push` 不等於從 TX FIFO 取資料；PIO `pull`／autopull 才和 TX → OSR 有關。官方 `demo_pio.pio` 的三行核心中沒有顯式 `pull`，不能擅自把它講成四條指令。若你改掉 autopull 設定，單靠原本三行程式未必仍能正常 Echo。

**紙筆練習：** CPU 先送 10 個 word 卻永遠不讀 RX，究竟先發生哪個 FIFO 的堵塞？這取決於 FIFO 水位與消費速度，不能只憑『TX 很忙』猜答案。要用 Trace 和水位確認；本節不是 RP2350 實機量測。
