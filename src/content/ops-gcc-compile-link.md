---
id: ops-gcc-compile-link
title: GCC：編譯、連結、警告與 pthread
category: 操作與除錯
tags: gcc,compile,link,pthread,error,-O2
aliases: 編譯失敗,undefined reference,header not found,Segmentation fault
difficulty: beginner
priority: P0
source_type: personal
source_url: https://gcc.gnu.org/onlinedocs/gcc/Option-Summary.html
verified: false
updated_at: 2026-11-13
summary: 分辨 compile error、link error 和 runtime error，給出可直接檢查的指令。
related: ops-make-targets,ops-debug-c
---

# C 專案不是「有 .c 檔就能直接編譯」

有 `Makefile` 時優先看它的建置命令。如果題目給單一 C 檔，才用基本例子：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic -O0 -g main.c -o app
./app
```

`main.c` 必須真的存在、包含完整程式和入口 `main()`。`-Wall/-Wextra/-Wpedantic` 是檢查警告，**不能保證沒有錯誤**；`-g` 產生除錯資訊；`-O0` 方便除錯但不適合作為效能比較的唯一版本。

## 多個 .c 的連結

```bash
gcc -std=c11 -Wall -Wextra -g main.c worker.c -o app -pthread
```

若程式使用 pthread，POSIX 平台常需 `-pthread`，它會影響編譯與連結設定。若看到 `undefined reference to foo`，通常是**連結**找不到符號：先查 `foo` 的實作是否進入這次建置、函式名稱是否正確、需不需要特定函式庫。加 `#include` 只能讓編譯器知道宣告，不會讓 `.c` 自動進入連結。

## 常見錯誤別亂修

- `fatal error: xxx.h: No such file or directory`：找檔案與 include path、套件／SDK，不要自己建立假的 header。
- `multiple definition`：可能有同名全域定義、重複連結，先找所有定義位置。
- `undefined reference to main`：可能使用了錯的建置目標或沒包含入口檔。
- 跑起來 Segmentation fault：屬於執行期問題，要檢查指標、索引與記憶體生命週期。

## 優化旗標

只有結果正確、測試可重現時，才拿同一環境測 `-O2` 與現有設定。`-O3` 不保證更快；`-Ofast` 可能放寬標準相容性，不要為了提高分數直接套用。

參考：[GCC Options](https://gcc.gnu.org/onlinedocs/gcc/Option-Summary.html)、[GCC Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html)。

## 延伸推演｜遇到變形題怎麼判斷

## 編譯成功不代表連結成功

C 一般會先把原始檔編譯成物件檔，再由 linker 把外部函式和其他檔案接起來。你只寫 `gcc main.c`，但 `main` 呼叫的 `engine_start` 實作其實在 `engine.c`，就可能出現 `undefined reference`。這不是 main.c 的語法錯，而是連結時找不到實作。

要看專案 Makefile 原本列哪些 `.c` 檔，和是否需要 `-pthread`。`#include "engine.h"` 只是讓編譯器知道函式宣告，**不會自動把 `engine.c` 編進去**。如果是標頭找不到，則屬於預處理／include path 問題，又和 linker 錯不同。

**變形：** 你只修改 `engine.h`，GCC 說 `implicit declaration`，先看標頭是否包含、函式原型是否一致和 C 標準版本，不要靠關閉所有警告掩蓋問題。
