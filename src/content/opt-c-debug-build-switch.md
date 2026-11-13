---
id: opt-c-debug-build-switch
title: Debug 與正式執行模式分開，但結果要相同
category: C Programming
tags: C Programming, c-io-buffering, 考場判讀
aliases: opt-c-debug-build-switch, Debug 與正式執行模式分開，但結果要相同
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html
verified: false
updated_at: 2026-11-13
summary: 用編譯條件區分診斷與正式輸出，確保數值行為一致。
related: ncku-v2-c-io-buffering
---

# Debug 與正式執行模式分開，但結果要相同

## 為什麼要分模式

把 `printf` 當暫時觀察工具可以，但考場答案只能包含規定格式。建議除錯資訊一律到 `stderr`；正式輸出留在 `stdout`。不要讓 `#ifdef DEBUG_MODE` 包住計算、邊界檢查或必要同步。

<!-- test: full-c -->
```c
#include <stdio.h>
static int solve(int x) {
#ifdef DEBUG_MODE
    fprintf(stderr, "input=%d\n", x);
#endif
    return x * 2;
}
int main(void) {
    int a = solve(7);
    if (a != 14) return 1;
    printf("%d\n", a);
    return 0;
}
```

## 編譯與驗收

```bash
cc -std=c11 -O2 -Wall -Wextra -pedantic demo.c -o release
cc -std=c11 -O2 -Wall -Wextra -pedantic -DDEBUG_MODE demo.c -o debug
./release >release.out 2>release.err
./debug >debug.out 2>debug.err
cmp release.out debug.out
```

上面命令假設已將程式儲存成 `demo.c`。`cmp` 應該相同，`debug.err` 可多診斷。**不要**把 `-DNDEBUG` 當成關閉自訂 `DEBUG_MODE` 的同義詞；它的標準效果主要是停用 `assert`，如果把必要測試塞在 `assert` 裡反而會出錯。

## 來源與驗證界線

- 參考：https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
## 深讀延伸｜把原理放進真實情境
## `-DNDEBUG` 為什麼有時讓「測試」全部消失？

C 的 `assert(expr)` 在定義 `NDEBUG` 後通常會整段停用。若你把真正必須執行的檢查寫成 `assert(parse_packet(...))`，Release 版連 `parse_packet` **都可能不呼叫**。因此不能把有副作用或必要功能的呼叫藏在 `assert` 裡。

```c
// 錯誤：NDEBUG 可能移除整個 parse_packet 呼叫
// assert(parse_packet(buf, len));
// 正確：先執行函式，再處理失敗
// bool ok = parse_packet(buf, len);
// if (!ok) return ERROR_BAD_PACKET;
// assert(ok);  // 只作除錯期額外核對
```

另一個常見問題是 Debug 有印 log、Release 沒印 log，但程式本來就靠某行 `printf` 的延遲「碰巧」避免兩條 Thread 同時讀寫。移除 log 後出現 Data Race，不代表 Release 編譯器壞了，而是原程式同步不正確。Debug/Release 都要跑相同的功能測試；效能比較則不要把 Sanitizer 版拿去和未加 Sanitizer 版當公平基準。

**小測：** 兩種編譯版本都要檢查「出錯時是否回傳非零」「輸入完整時答案相同」，而不是只看最後印了一句 `OK`。

## 可獨立執行的邊界測試

下面是從頭到尾可執行的練習（`debug_assert_side_effect.c`），與官方 Demo 的程式分開；測的是本頁的資料與邊界規則。使用 `gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic -pthread` 編譯後執行。程式在 v10 的 Linux 本機驗證中通過，但這**不代表**已測 ROS 2 或 RP2350 開發板。

```c
#include <stdio.h>
#include <stdbool.h>
static int calls=0;
static bool parse(void){++calls; return true;}
int main(void){
    /* Important operation runs independently of assert() and NDEBUG. */
    bool ok=parse();
    if(!ok || calls!=1)return 1;
    puts("business operation not inside assert PASS");return 0;
}
```

請先預測輸出，再改動一個邊界條件看看檢查為什麼會失敗。不要只記住測試印出 `PASS`，最好能指出哪一筆輸入應該被拒絕，或哪個輸出必須保留。
