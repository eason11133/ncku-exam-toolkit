---
id: opt-benchmark-stdin-and-rate
title: 測試命令與吞吐量：stdin、argv、時間、單位別搞混
category: Performance Engineering
tags: stdin,argv,benchmark,throughput,GNU time,diff
aliases: 讀入測資,stdin 重導向,傳參數,benchmark 單位,吞吐量
source_type: personal
source_url: https://www.gnu.org/software/time/
verified: false
updated_at: 2026-11-13
summary: 說清楚 ./app input.txt 和 ./app < input.txt 的差別，以及一批多筆工作的吞吐計算。
related: ops-perf-test-protocol,ops-gcc-compile-link
priority: P0
difficulty: beginner
---

# 同一個 `input.txt`，可能是兩種完全不同的執行方式

```bash
./app input.txt
./app < input.txt
```

第一行是把字串 `input.txt` 當成**命令列參數**，例如 C 的 `argv[1]`；第二行是讓程式從**標準輸入 stdin** 讀取檔案內容，例如 `scanf()`、`fgets(stdin)`、Python `input()`。如果考題是標準輸入型 OJ，拿第一行測試可能根本沒餵到資料，進而得到假的效能結果。先看 `main` 接收參數的方式，或檢查題目給的測試指令。

## Linux／Bash 正確性與時間一起量

```bash
# 檔名和程式路徑請依專案修改；這是 stdin 型題目
/usr/bin/time -f 'wall_s=%e user_cpu_s=%U max_rss_kb=%M' \
  -o timing.txt ./app < sample.in > output.txt
status=$?
printf 'exit_status=%s\n' "$status"
# 只有當官方提供 expected.txt 且程式成功退出時才做比較
diff -u expected.txt output.txt
```

`/usr/bin/time` 是 GNU time 的常見路徑，但不是所有系統都裝在那裡。`diff` 比對成功只表示**這份測資**的文字輸出完全相同。若程式輸出允許浮點誤差、非固定順序或其他評測規則，就不能只用字串 diff 當唯一正確性判斷。上述是**操作指令**，不要在沒有 `sample.in`／`expected.txt` 的資料夾盲目執行。

## 吞吐量的分母與分子必須相配

假設測一整批 1000 筆工作，總共花 2 秒，吞吐量應為 `1000 / 2 = 500 筆/秒`。不能看到「一次執行花 2 秒」，就直接算 `1 / 2 = 0.5 筆/秒`，除非那一次真的只完成**一筆工作**。

同樣道理，單次請求的平均延遲是 5 ms，不保證整個系統的 throughput 一定是每秒 200 筆；有並行、排隊、批次、I/O 等因素時，兩者不是簡單倒數。

## 基準測試最少保留這些資料

版本／Commit、相同輸入、編譯旗標、環境、正確性、總完成筆數、總 wall time、CPU time、記憶體。先確定兩個版本**完成了相同且正確的工作**，再比較時間。若某一版錯誤或掉資料，就不能拿它的速度當有效基準。
