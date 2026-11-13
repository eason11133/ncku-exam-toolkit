---
id: opt-c-sanitize-then-benchmark
title: ASan／UBSan 是抓錯工具，不是效能版本
category: Performance Engineering
tags: Performance Engineering, compiler-profile-guided, 考場判讀
aliases: opt-c-sanitize-then-benchmark, ASan／UBSan 是抓錯工具，不是效能版本
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html
verified: false
updated_at: 2026-11-13
summary: 把 Sanitizer 與正常 Release 測速切開。
related: ncku-compiler-profile-sanitize
---

# ASan／UBSan 是抓錯工具，不是效能版本

## 先抓會破壞答案的問題

`-fsanitize=address` 可協助發現越界、use-after-free，`-fsanitize=undefined` 能偵測不少未定義行為（例如某些整數溢位、非法位移）。這是**動態檢查**，沒有跑到的程式路徑不會因此證明安全。資料競爭需另外做同步推理，TSan 與 ASan 不能直接合併使用。

```bash
cc -std=c11 -O1 -g -fno-omit-frame-pointer \
  -fsanitize=address,undefined main.c -o prog_check
./prog_check < input.txt
cc -std=c11 -O2 main.c -o prog_release
./prog_release < input.txt
```

如果程式用 pthread，編譯時另加 `-pthread`。環境不支援 sanitizer 時不要把失敗當成原始程式必定錯；確認 GCC 版本、動態函式庫與報錯訊息。不要把 `prog_check` 的時間拿去跟 release 當公平效能比較。

## 可直接用的最小 C 範例

<!-- test: full-c -->
```c
#include <stddef.h>
#include <stdio.h>
static int sum(const int *a, size_t n) {
    int result = 0;
    for (size_t i = 0; i < n; ++i) result += a[i];
    return result;
}
int main(void) {
    int a[4] = {1,2,3,4};
    if (sum(a,4) != 10) return 1;
    puts("sum=10");
    return 0;
}
```

這是正確例子，Sanitizer 執行不報錯才是預期；它不是刻意示範如何觸發錯誤。另以邊界、空輸入、大量輸入建立正確性測試。

## 來源與驗證界線

- 參考：https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。
