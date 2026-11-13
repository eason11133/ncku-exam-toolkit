---
id: opt-c-sanitizer-before-speed
title: C Sanitizer 與最佳化對照：測不到不算修好
category: Debugging
tags: C, GCC, sanitizer, undefined behavior, benchmark
aliases: opt-c-sanitizer-before-speed, C Sanitizer 與最佳化對照
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html
verified: false
updated_at: 2026-11-13
summary: Sanitizer 必須觸發對應路徑；O2 與 O0 結果不同時優先排查 UB。
related: ncku-compiler-profile-sanitize
---

# 編譯成功不等於正確，Sanitizer 沒報錯也不是證明

程式在 `-O0` 看起來正常、`-O2` 卻出錯時，先查未定義行為、未初始化資料、越界和執行緒同步。不要只調低優化旗標讓錯誤暫時消失。

## 基本命令（用你真正的原始碼代替 main.c）

```bash
gcc -std=c11 -O0 -g -Wall -Wextra main.c -o prog_o0
gcc -std=c11 -O2 -g -Wall -Wextra main.c -o prog_o2
gcc -std=c11 -O1 -g -Wall -Wextra -fno-omit-frame-pointer \
    -fsanitize=address,undefined main.c -o prog_san
./prog_o0 < input.txt > output_o0.txt
./prog_o2 < input.txt > output_o2.txt
./prog_san < input.txt > output_san.txt
cmp output_o0.txt output_o2.txt
cmp output_o0.txt output_san.txt
```

上面 `input.txt` 是你已有的真實測資檔案；沒有檔案先別照貼執行。程式若讀 argv 而非 stdin，應依原程式的輸入介面修改。Sanitizer 必須真的執行到有錯的路徑才可能報錯；`cmp` 只驗證標準輸出相同，不能驗證檔案輸出、記憶體安全或所有隱藏測資。

## 這幾件事容易混淆

`-fsanitize=address` 可檢查部分空間／生命週期錯誤；`-fsanitize=undefined` 可檢查某些未定義行為；`-fsanitize=thread` 專查資料競爭，不能和 ASan 在同一次編譯中使用。TSan 在部分容器或沙盒可能無法正常啟動，不能因環境限制就把沒有執行的測試寫成 PASS。

如果出現 signed overflow，修的是型別與邊界，不是刪除觸發錯誤的測資。比較效能時不能把 Sanitizer 版本與普通 Release 版本直接作速度結論；它們有不同 runtime overhead。

**考場驗收**：保留錯誤輸入、編譯器版本、錯誤訊息、修改前後結果。先通過正確性再量時間，測 O0/O2、多組邊界及工具真正有執行到的情形。
