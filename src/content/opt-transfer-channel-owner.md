---
id: opt-transfer-channel-owner
title: Transfer Channel 的 Claim → Wait → Release 順序
category: DMA
tags: DMA, transfer-channel-scheduling, 考場排查, 實作條件
aliases: opt-transfer-channel-owner, Transfer Channel 的 Claim → Wait → Release 順序
difficulty: intermediate
priority: P0
source_type: personal
verified: false
updated_at: 2026-11-13
summary: 取得通道後要有唯一擁有者及清理責任；官方 Demo 是 pthread 模擬，不是真實 DMA。
related: ncku-v2-transfer-channel-scheduling
---

# Channel 是借來的資源，不能只看「有沒有傳完」

官方 `demo/section2-3/transfer-engine/engine.h` 的介面包含 `engine_claim`、`engine_configure`、`engine_start`、`engine_wait`、`engine_release`。一個 Channel 被 claim 後不 release，其他工作可能取得 `-1`；而工作沒完成前就 release 會破壞資料生命週期。

## 依官方介面的整合片段

```c
/* 使用官方 demo engine.h、且 src/dst 容量與對齊已事先確認。
   這是整合片段，非獨立程式。 */
int ch = engine_claim();
if (ch < 0) {
    /* 依題目規則：等待／同步回退／回報資源不足，不能使用 -1。 */
    return;
}
engine_configure(ch, &job); /* job.count 是傳輸筆數，非 bytes */
engine_start(ch);
/* CPU 此時只能使用與此次傳輸緩衝區無衝突的資料。 */
engine_wait(ch);            /* 等待工作確實完成後再讀結果 */
engine_release(ch);         /* 釋放通道 */
```

這段示意以回傳 `void` 的上層函式為前提；真實程式的 error handling 要明確。`engine_configure` 若檢查失敗，官方 Demo 會直接結束程序；其 `engine_busy` 使用 `volatile bool` 作跨執行緒同步，**不符合 C data-race 安全要求**，在未修正前不可當成實際安全的傳輸框架。

## 哪些地方特別容易出錯

`engine_start()` 回來不是完成；來源在傳輸期間不可被其他 Thread 任意覆寫或釋放。目的緩衝在完成前不可當完整結果使用。所有通道數量有限，重複 claim、configure 已開始的通道、release 後繼續使用，都要避免。真正 MCU 的 DMA 完成語意及快取同步還需照硬體文件查。

**驗收**：用 1、4、5 個順序請求測通道獲取失敗；正常與錯誤路徑都要核對 claim/release 成對，目的 bytes 逐項比對。這份只核對官方模擬引擎介面，不宣稱整個 `engine.c` 執行緒同步已安全。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：拿到 Channel 不代表工作已經完成

把 Channel 想成必須歸還的借書證。`claim` 成功後你有使用權，`start` 只是把工作送出去；**只有正確的完成通知／等待確定結束後，才能宣稱結果可讀、資源可回收**。假設你把 4,096 筆資料分兩批：第一批還沒搬完，就把來源 Buffer 改成第二批，第一批的目的地可能混入第二批的值。

可用簡單的狀態推演：`FREE → CLAIMED → CONFIGURED → RUNNING → COMPLETED → RELEASED`。`engine_claim()` 回 `-1` 表示這次沒拿到，不能拿 `-1` 硬塞進 `engine_configure()`；`engine_wait` 應只對有效且已開始的 Channel 呼叫，錯誤路徑也要明確處理清理責任。官方 Demo 的模擬 Engine 不是 RP2350 的硬體 DMA。

**驗收不是只看輸出總和。** 準備 `src[i]=i*3+1`，搬完逐項檢查 `dst[i]==src[i]`；總和一樣仍可能某幾筆互換。再測沒有空 Channel、`count=0` 是否受官方介面允許、最後一塊不足、來源覆寫等情況。注意官方 Engine 的 `volatile bool busy` 跨 Thread 同步存在資料競爭風險，**不能把這份 Demo 當正確的 pthread 同步範本**。

**來源核對：** 這篇現有 frontmatter 的 POSIX `pthread_join` 連結只支持執行緒 API，**不能證明自訂的 `engine_claim` 等函式介面**。真正證據應對照考場提供的 `demo/section2-3/transfer-engine/engine.h`、`engine.c`，匯入前須把來源欄位改成適當的本地 Demo 文件參照。

## 主來源與查證界線

本篇自訂 Transfer Engine API 以使用者提供的成大練習 Demo `demo/section2-3/transfer-engine/engine.h`、`engine.c` 為主來源；`engine.h` 定義公開介面，`engine.c` 顯示 pthread 模擬與通道生命週期。這不是 Pico SDK 的 DMA API，亦未在本輪重新編譯完整 Demo。
