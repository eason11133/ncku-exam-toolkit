---
id: ops-debug-python
title: Python 除錯：Traceback、模組、虛擬環境
category: 操作與除錯
tags: Python,traceback,venv,pip,debug,exception
aliases: ModuleNotFoundError,IndexError,TypeError,Python 環境,找不到模組
difficulty: beginner
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/traceback.html
verified: false
updated_at: 2026-11-13
summary: 利用 Traceback 定位真正出錯的程式行，不把所有例外都歸因於套件未安裝。
related: ops-perf-cpu-memory,ops-unknown-repo-first-look
---

# 從最後一行開始讀 Traceback，再往上找自己的程式

Python Traceback 通常會指出例外類型（例如 `ValueError`、`IndexError`、`ModuleNotFoundError`）及呼叫鏈。最後一行是錯誤種類，不一定能直接看出根因；要搭配發生位置與實際輸入。

```bash
python3 --version
python3 -m pip --version
python3 app.py
```

`python3` 是否存在依系統而定；Windows 常用 `py` 或 `python`。`pip` 與 `python` 可能不是同一個環境，所以在能使用的前提下優先 `python3 -m pip`。**不要一看到 import 失敗就直接重灌整個環境**。

## 最小排查

```bash
python3 -c 'import sys; print(sys.executable); print(sys.version)'
python3 -m pip list
```

若專案已有虛擬環境或 Docker，先遵守現有操作說明，不在系統 Python 直接安裝依賴。`python -m venv` 建立的是一個新的隔離環境，**不會自動安裝專案需求**。

## 正確性問題

遇到 `IndexError`，先看索引與輸入長度；`KeyError` 先看鍵是否存在；`TypeError` 先看傳入的資料型別與函式參數。可以暫時加少量 log，但不要直接把每筆資料全印出來造成效能失真。

參考：[Python traceback](https://docs.python.org/3/library/traceback.html)、[Python venv](https://docs.python.org/3/library/venv.html)。

## 延伸推演｜遇到變形題怎麼判斷

## 先看 Traceback 的最下面，再回去追資料來源

Python 的錯誤訊息常在最後一行說明例外種類，例如 `IndexError: list index out of range`。這代表你用了超出 list 邊界的索引，但不一定是出錯行自己算錯；有可能上游傳來空 list。先找到「你的檔案」中最靠近錯誤的呼叫位置，印出索引、長度和關鍵輸入，再往回追誰傳了這組值。

例如 `data[-1]` 在非空 list 合法，在空 list 會拋 `IndexError`。若你把 `sorted(data)[-1]` 改成 `max(data)`，空 list 又會變成 `ValueError`。這兩個解法都需要在外面先定義空輸入該回傳什麼，不是換個函式就可以免除邊界處理。

`ModuleNotFoundError` 則先查 Python 解譯器和套件安裝的環境：`python -V`、`python -m pip --version`。有安裝不代表**正在跑的那個 Python** 一定看得到；多個虛擬環境的 `python` 可能各自不同。
