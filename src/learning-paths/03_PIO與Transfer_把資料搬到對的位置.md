# 實戰導讀 03｜PIO 與 Transfer Engine：不要只記 API 名稱

> 本篇刻意把「PIO 硬體指令」、「官方用 pthread 寫的模擬 Transfer Engine」分成兩套。兩者會一起出現在考題概念裡，但不是同一塊硬體。本包無 RP2350 實機驗證。

## PIO Echo：先問這個 word 目前在哪裡

官方 PIO Echo 的三條關鍵指令是：

```pio
out x, 32
in x, 32
push
```

如果 State Machine 已設定適當的 autopull 和移位方向，CPU 放到 TX FIFO 的 32-bit word 會被補進 OSR，`out x,32` 搬到 X，`in x,32` 再搬到 ISR，`push` 送進 RX FIFO，讓 CPU 取回。

這裡有三個常見誤會：第一，`push` 往的是 RX FIFO，不是從 TX FIFO 讀；第二，`in` 修改 ISR，並不直接出現在 CPU 的輸出結果；第三，既然 PIO 原始碼沒有顯式 `pull`，就必須確認 autopull 設定，不能把它當作「沒有來源也會自己吐資料」。

## FIFO 為什麼會卡住

如果 CPU 只一直送、不讀 RX，RX FIFO 滿後阻塞式 `push` 可能停住；PIO 停住又不消耗 TX，最終 CPU 的 `pio_sm_put_blocking` 也可能等不到空位。反過來，CPU 若先呼叫 `pio_sm_get_blocking` 卻還沒送第一筆 TX，且沒別的執行路徑供資料，就可能卡死在讀取那行。

要追的是 **哪個位置先沒有前進**，不是單憑「還有幾筆 TX」就斷定 CPU 或 PIO 太慢。真正的 SDK 裡 raw `pio_sm_get` 在 RX 空時會有 RXUNDER，回傳值未定義，不能只為了避免阻塞就改用 raw 讀取。

## Transfer Engine：`count` 和 `size` 不是同一個單位

假設每筆資料 4 bytes、共有 10 筆、每輪搬 4 筆。三批是 4、4、2 筆；要搬的 byte 數依次是 16、16、8。如果自訂 Engine 的 `count` 代表筆數，你不能直接把 40 當 count 塞進去。相反地，呼叫 `memcpy` 時第三個參數是 byte 數；同一段邏輯換了 API，單位就不一樣。

練習自己算：來源陣列有 10 筆、目的陣列有 9 筆，數學上的總長 40 bytes 沒溢位，但仍然應該**拒絕**，因為目的容量不夠。再把每批改成 6 筆，應搬 6、4；最後一批絕不可因為原本 Chunk Size 是 6 就讀到第 11、12 筆。

## Claim、Start、Wait、Release：不要把開始當完成

官方模擬 Engine 使用 Channel。`claim` 失敗就要有安全回退，不能傳 `-1`；`start` 之後結果還可能在處理中；完成前不能改寫來源、不能提前讀取未完成的目的；確認完成與正確清理後才能 Release。**官方模擬 Engine 裡的 `volatile busy` 不是正確的跨執行緒同步證明**，不能拿來當所有 pthread 最佳實作的範本。

| 檢查點 | 通過條件 | 最容易犯的錯 |
|---|---|---|
| PIO 的來源 | TX → OSR 的 autopull 條件明確 | 把 push 當 pull |
| PIO 的結果 | ISR → RX 後 CPU 才能取 | 直接讀空 FIFO |
| 搬運單位 | `count` 是筆數，`memcpy` 用 bytes | 乘錯或少乘 `sizeof` |
| 最後一塊 | `min(chunk, n-offset)` | 用固定 Chunk 讀超過尾端 |
| Buffer 擁有者 | 完成後再讀、再重用 | start 回來就覆寫 |
| 正確性驗證 | 逐筆比對而非只比總和 | 一筆重複、一筆漏掉卻總和相等 |

**帶回去練：** 寫 `src[i]=3*i+1` 搬到目的地，末端留一格 Canary。跑完檢查全部元素及 Canary 未被覆寫。這是 C 中分塊與容量邏輯的練習，**不是硬體 DMA 吞吐量測試**；目前站內沒有獨立的 `transfer_last_chunk.c` 範例檔。

**相關詞條：** PIO、State Machine、TX/RX FIFO、OSR、ISR、Autopull、PUSH、DREQ、DMA、Channel、Buffer Ownership、Data Race、`sizeof`、Big-endian。

SDK 參考：<https://www.raspberrypi.com/documentation/pico-sdk/hardware.html>；官方 Demo 需對照提供的 `section2-2` 與 `section2-3` 原檔。
