---
id: opt-transfer-unit-capacity
title: Transfer Engine：count × size、容量與 Copy/Fill 的正確檢查
category: Embedded Systems
tags: transfer engine,bytes,count,size,buffer,overflow,copy,fill
aliases: 傳輸筆數,傳輸大小,超出緩衝,engine_configure,DMA count
source_type: personal
source_url: https://en.cppreference.com/w/c/types/size_t.html
verified: false
updated_at: 2026-11-13
summary: 把官方 Demo 的單位錯誤轉成可測的應用端容量檢查，不混淆軟體模擬與硬體 DMA。
related: ops-pthread-create-join,opt-c-safe-packet-reader
priority: P0
difficulty: intermediate
---

# `count` 是筆數，不是 bytes

官方 2-3 模擬引擎使用 `engine_job_t`：`count` 表示搬運幾次，`size` 是每次搬的 bytes，支援 1／2／4。要複製 `4096` 個 `uint32_t`，應填 `count=4096`、`size=4`，總 bytes 才是 `16384`。若把 `count=16384` 當成 bytes 填入，引擎會嘗試搬運 `65536` bytes。

官方 `make mistake` 特意準備四倍容量來展示「超出預定使用範圍」，**並不是實測寫出實際配置的陣列邊界**。真實題目不能靠運氣，啟動前必須先確認來源、目的地的有效容量。

## 完整可編譯的 C11 容量檢查範例（不是官方 engine API 實作）

```c
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

static bool valid_copy(size_t count, size_t size,
                       size_t source_bytes, size_t destination_bytes) {
    if (count == 0u || (size != 1u && size != 2u && size != 4u))
        return false;
    if (count > SIZE_MAX / size) return false; /* 防止 count*size overflow */
    size_t bytes = count * size;
    return bytes <= source_bytes && bytes <= destination_bytes;
}

int main(void) {
    uint32_t src[4] = {1u, 2u, 3u, 4u};
    uint32_t dst[4] = {0u, 0u, 0u, 0u};
    if (!valid_copy(4u, sizeof src[0], sizeof src, sizeof dst)) return 1;
    if (!valid_copy(1u, sizeof src[0], sizeof src, sizeof dst)) return 4;
    if (valid_copy(0u, sizeof src[0], sizeof src, sizeof dst)) return 5;
    if (valid_copy(16u, sizeof src[0], sizeof src, sizeof dst)) return 2;
    if (valid_copy(SIZE_MAX, 4u, sizeof src, sizeof dst)) return 3;
    printf("copy-count-check=ok\n");
    return 0;
}
```

Linux：`gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic transfer_check.c -o transfer_check && ./transfer_check`。預期 `copy-count-check=ok`。此例**只檢查容量，並沒有真的搬資料**；`transfer_check.c` 是你存放上面程式的檔名。

## Copy 與 Fill 的容量不同

- **Copy**：來源和目的都遞增，各自至少要 `count × size` bytes。
- **Fill**：來源固定（`src_increment=false`），來源只需至少一個 `size` 單位，目的若遞增則仍需 `count × size` bytes。
- **非遞增目的地**：每次都寫同一個目的位址，不能用一般 Copy 的「連續輸出」邏輯推論結果。

容量之外，還要檢查來源與目的的對齊、有效生命週期，以及搬運完成前不能提前重用。真實 DMA 的約束不一定和這個 pthread 模擬引擎完全相同。

## 為什麼 `engine_busy()` 不能直接當跨 Thread 安全範本？

官方模擬 `engine.c` 使用 `volatile bool busy` 在工作執行緒與主執行緒之間傳遞狀態。`volatile` **不是同步原語**，這種未同步的跨執行緒讀寫有 Data Race 風險。要修改正式軟體引擎時，應考慮 C11 atomic、mutex 或正確的完成等待；不要只把 `volatile` 換成普通 `bool`。同時也要檢查 `pthread_create` 返回碼與 Thread 回收。沒有實作修正之前，不應宣稱該原始模擬引擎是 Thread-safe。

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`checked_transfer_bytes.c`）。**與上方範例使用同一個 `count > 0` 規則**，與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。使用 `gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic -pthread` 編譯後執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```c
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

static bool enough_capacity(size_t count,size_t size,
                            bool src_increment,bool dst_increment,
                            size_t src_len,size_t dst_len) {
    /* 對齊 engine_configure：count 必須大於 0，size 僅為 1/2/4。 */
    if(count==0 || (size!=1 && size!=2 && size!=4))return false;
    if(count>SIZE_MAX/size)return false;
    size_t bytes=count*size;
    size_t needed_src=src_increment?bytes:size;
    size_t needed_dst=dst_increment?bytes:size;
    return needed_src<=src_len && needed_dst<=dst_len;
}
int main(void) {
    /* Copy: 來源與目的都遞增，各需 16384 bytes。 */
    if(!enough_capacity(4096,4,true,true,16384,16384))return 1;
    if(enough_capacity(4097,4,true,true,16384,16384))return 2;
    /* Fill: 同一筆 4-byte 來源反覆讀取，目的仍需 16384 bytes。 */
    if(!enough_capacity(4096,4,false,true,4,16384))return 3;
    if(enough_capacity(4096,4,false,true,3,16384))return 4;
    if(enough_capacity(4096,4,false,true,4,16383))return 5;
    if(!enough_capacity(1,1,true,true,1,1))return 6;
    if(enough_capacity(SIZE_MAX,4,true,true,SIZE_MAX,SIZE_MAX))return 7;
    if(enough_capacity(1,3,true,true,10,10))return 8;
    if(enough_capacity(0,4,true,true,0,0))return 9;
    puts("transfer byte count and overflow checks PASS");return 0;
}
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。
