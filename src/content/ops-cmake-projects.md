---
id: ops-cmake-projects
title: CMake：設定、建置與測試既有 C/C++ 專案
category: 操作與除錯
tags: CMake,CTest,C++,build,CMakeLists
aliases: cmake build,Could NOT find,設定 CMake,No tests were found
difficulty: beginner
priority: P0
source_type: personal
source_url: https://cmake.org/cmake/help/latest/manual/cmake.1.html
verified: false
updated_at: 2026-11-13
summary: 遇到 CMakeLists.txt 時，用分離的 build 目錄避免污染來源。
related: ops-unknown-repo-first-look,ops-gcc-compile-link
---

# 先確認有沒有 CMake

如果目錄有 `CMakeLists.txt`，可能使用 CMake。**有檔案不代表已安裝 CMake、也不代表所有第三方依賴都可用。**

```bash
cmake --version
ls -la
sed -n '1,140p' CMakeLists.txt
```

## 一般的 out-of-source build

```bash
cmake -S . -B build
cmake --build build
```

`-S .` 是 source 目錄；`-B build` 是建置輸出目錄。若 CMakeLists.txt 使用自訂選項、交叉編譯或 SDK 工具鏈，不能直接套標準命令。先讀 README 的版本與平台要求。

## 測試

```bash
ctest --test-dir build --output-on-failure
```

只有在專案用 CTest 註冊測試時才會跑到實際測試；`No tests were found` **不是測試通過**。不要看到 Build 成功就說功能正確。

## 遇到錯誤

`Could NOT find ...` 可能是缺套件或路徑設定；`CMAKE_C_COMPILER not set` 可能未找到工具鏈。不要隨意加 `sudo`、下載不明套件；依既有題目環境先核對依賴。若 build 目錄裡有先前設定快取，變更工具鏈時可能需要全新建置目錄，但請別直接刪整個專案。

參考：[CMake CLI](https://cmake.org/cmake/help/latest/manual/cmake.1.html)、[CTest](https://cmake.org/cmake/help/latest/manual/ctest.1.html)。
## 看見 `CMakeLists.txt`，要先做什麼？

你熟悉的 `gcc main.c -o main` 是直接叫編譯器；`make` 依 Makefile 內的規則決定怎麼編；**CMake 是先產生建置規則**，它本身不是 GCC。這三件事不能替換成同一句命令。

一個最小 CMake 專案可以長這樣：

```text
project/
├─ CMakeLists.txt
├─ main.c
└─ test.c
```

`CMakeLists.txt` 中 `add_executable(app main.c)` 才告訴 CMake 要編哪個檔案；如果沒有宣告測試，即使執行 `ctest`，也可能顯示 `No tests were found!!!`。那不是所有測試 PASS，而是 **根本沒有測到東西**。

### 為什麼習慣使用 `-B build`？

```bash
cmake -S . -B build
cmake --build build
ctest --test-dir build --output-on-failure
```

第一行讀取目前的專案，並把生成檔案放在 `build/`；第二行才真正編譯；第三行執行**已註冊**的測試。這樣原始碼與中間產物不會混在一起。建置失敗，先看第一個 `error:` 的檔案與行數；不要為了「讓 Build 綠燈」隨意刪掉出錯的檔案。

### 自己判斷考場專案該用哪條路

只有 `main.c`：可以先查題目要求，再用 GCC。看到 Makefile：`make help`（若有這個 target）或讀 Makefile 的 targets。看到 `CMakeLists.txt`：先跑設定與建置。看到 ROS 2 的 `package.xml`、`ament_cmake`：還要留意 ROS workspace 和 `colcon`，不能拿最小 CMake 範例直接替代 ROS 建置流程。

**易錯點：** `cmake --build build` 成功不代表程式的輸出正確；`ctest` 顯示零項測試也不代表全部功能沒問題。
