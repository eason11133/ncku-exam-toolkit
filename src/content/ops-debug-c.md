---
id: ops-debug-c
title: C/C++ 除錯：GDB、AddressSanitizer、UBSan
category: 操作與除錯
tags: C,GDB,ASan,UBSan,sanitizer,segfault
aliases: 記憶體錯誤,Segmentation fault,bt,breakpoint,越界
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html
verified: false
updated_at: 2026-11-13
summary: 編譯成功但結果錯，先縮小輸入，再用偵錯工具定位錯誤行。
related: ops-gcc-compile-link,ops-perf-test-protocol
---

# 編譯成功不等於執行正確

先建立一個能重現錯誤的最小輸入，保留原始版本。若環境有 GCC 與 GDB：

```bash
gcc -std=c11 -Wall -Wextra -O0 -g main.c -o app
gdb --args ./app
```

在 GDB 互動介面可以輸入：

```text
break main
run
next
print variable_name
bt
quit
```

`variable_name` 必須換成程式中存在的變數。`bt` 顯示呼叫堆疊；如果程式是多執行緒，還需看 thread 狀態、共享資料是否有同步。

## 記憶體錯誤檢查

若編譯器支援 AddressSanitizer 和 UndefinedBehaviorSanitizer：

```bash
gcc -std=c11 -Wall -Wextra -O1 -g \
  -fsanitize=address,undefined -fno-omit-frame-pointer \
  main.c -o app
./app
```

Sanitizer 是**診斷工具**，會增加執行時間與記憶體使用量；不能用 Sanitizer 版本當正式效能成績。工具未回報問題也不保證程式沒有 bug。多執行緒競爭的檢查需要另用正確性測試、同步分析，必要時在支援環境使用 ThreadSanitizer；不能把 ASan 當作 data race 的完整證明。

## 查錯時先想四件事

指標是否有效、陣列索引是否越界、資料型別是否匹配、是否在多執行緒中同時修改共享資料。看到 `SIGSEGV` 不要立刻猜是 Stack Overflow。所有修改都要回歸測試。

參考：[GCC Instrumentation Options](https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html)、[GDB](https://www.gnu.org/software/gdb/documentation/)。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 真的遇到錯誤時，照一次「追值」而不是亂猜

想像程式把 4 個整數加總，預期 10，卻得到 6。先把輸入固定，找到哪個變數在哪一步變成了不對的值，再問為什麼。

下面程式可以正常跑，但做的是故意寫錯的功能：

```c
/* 故意錯誤，用來練 GDB；不是正確範例 */
#include <stdio.h>
int main(void) {
    int a[] = {1, 2, 3, 4};
    int sum = 0;
    for (int i = 0; i < 3; ++i) sum += a[i]; // 漏掉 a[3]
    printf("sum=%d\n", sum);
    return 0;
}
```

`gcc -O0 -g bug.c -o bug`，再用 `gdb ./bug` 執行 `break main`、`run`、`next`，觀察 `i` 和 `sum`。真正的問題是迴圈只跑到 `i=2`，應改成 `i<4` 或依 `sizeof a/sizeof a[0]` 算元素數。

**不要把所有錯誤都當記憶體越界。** 此例程式可正常編譯、沒有越界，Sanitizer 也未必報錯；需要用題意的期望值和實際值比對才能抓到。


---

<!-- v11: reviewed_deep_reasoning -->

## 深讀：工具沒有報錯，還是可能答案錯

你有一段 C 程式要把 `{1,2,3,4}` 加總。原碼的迴圈只跑到 `i<3`，印出 6。這段**完全沒有越界或未定義行為**，ASan/UBSan 很可能不會回報任何錯誤。這時候你應該把「預期=10」寫成測試，沿著每輪 `i`、`sum` 去追，而不是一直換編譯旗標。

另一種反過來：程式偶爾崩潰，你先用 `-O0 -g` 在 GDB 看堆疊，再用 `-fsanitize=address,undefined` 找越界或未定義操作。**不要**把 AddressSanitizer 和 ThreadSanitizer 同時加到同一次編譯，GCC 文件說這兩者不相容。若是執行緒資料競爭，應另建 TSan 版本或做同步分析；TSan 跑通也不是數學上的無競爭證明。

考場實用順序：先固定最小測資 → 確定期望輸出 → 看是哪一步開始不同 → 再挑工具。效能測試必須回到未開 Sanitizer 的正式編譯選項，且用同樣輸入與輸出比對。
