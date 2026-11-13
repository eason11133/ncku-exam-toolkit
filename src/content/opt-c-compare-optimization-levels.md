---
id: opt-c-compare-optimization-levels
title: O0／O2／O3 要先驗證答案，再比較速度
category: Performance Engineering
tags: Performance Engineering, compiler-profile-guided, 考場判讀
aliases: opt-c-compare-optimization-levels, O0／O2／O3 要先驗證答案，再比較速度
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html
verified: false
updated_at: 2026-11-13
summary: 最佳化等級升高不保證每個題型更快。
related: ncku-compiler-profile-sanitize
---

# O0／O2／O3 要先驗證答案，再比較速度

## 比較方法

固定同一份輸入、編譯器版本與參數，建立三個 binary。測「執行時間」時不要把編譯時間混進去；如果評分規則包含編譯，則另列總耗時。

```bash
cc -std=c11 -O0 -g -Wall -Wextra main.c -o prog_o0
cc -std=c11 -O2 -g -Wall -Wextra main.c -o prog_o2
cc -std=c11 -O3 -g -Wall -Wextra main.c -o prog_o3
./prog_o0 < input.txt > o0.txt
./prog_o2 < input.txt > o2.txt
./prog_o3 < input.txt > o3.txt
cmp o0.txt o2.txt && cmp o2.txt o3.txt
/usr/bin/time -p ./prog_o0 < input.txt > /dev/null
/usr/bin/time -p ./prog_o2 < input.txt > /dev/null
/usr/bin/time -p ./prog_o3 < input.txt > /dev/null
```

`/usr/bin/time` 是可選工具；如果沒安裝，用 shell `time` 但紀錄單位。上面使用 `< input.txt` 是餵給 stdin，和 `./program input.txt`（傳 argv）**不同**。

## 注意事項

`-O3` 可能增大程式碼或沒有改善；`-O2` 可能暴露未定義行為，不能把「不同輸出」當成 `-O2` 的 bug。輸出相同也不代表沒有 UB。先對照答案，再反覆量測（包含中位數、分布、CPU、記憶體）。不得拿一次最小值當成穩定效益。**這是可在 Linux 使用的操作指令，未在考場跑過。**

## 來源與驗證界線

- 參考：https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html
- 本文為候選離線教材，`verified: false`；有完整測試標記的程式需通過本機腳本。其他平台／硬體／ROS 2 均不以純文字推理冒充實測。

## 延伸推演｜遇到變形題怎麼判斷

## 為什麼 O3 不一定比 O2 快？

編譯器開啟更積極的最佳化，可能增加程式碼大小或改變快取、分支的表現。對某個輸入 O3 比 O2 快，不代表所有資料量都快。更重要的是，若 C 程式原本有 signed overflow、越界或 Data Race，編譯器假設沒有未定義行為後，可能讓錯誤變得更明顯。

先用同一份測資分別編 `-O0`、`-O2`、`-O3`，核對完整輸出、退出碼與邊界案例一致；只有正確才量測。Sanitizer 是找錯工具，不能和一般 Release 版當作同等效能基準。記得把編譯器版本與實際編譯旗標一起記錄。

**變形：** O0 結果正確、O2 錯誤。不要立即斷言 O2 編譯器有 Bug；先用 UBSan、ASan 與程式邏輯檢查未定義行為。哪一版快不會改變正確性的要求。
