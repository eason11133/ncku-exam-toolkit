---
id: ros2-ste-process-pool
title: SingleThreadedExecutor：把大量 Python 計算交給獨立 Process
category: ROS 2
tags: ROS 2,multiprocessing,ProcessPoolExecutor,GIL,CPU bound
aliases: multiprocessing,ProcessPoolExecutor,CPU-bound,多核心
source_type: personal
source_url: https://docs.python.org/3.12/library/concurrent.futures.html
verified: false
updated_at: 2026-11-12
summary: Python 大量運算真正吃 CPU 時，可以評估用其他 Process 工作，但每次傳資料與收結果都有成本。
related: ros2-ste-short-callback,ros2-ste-multithreaded-groups
priority: P1
difficulty: intermediate
---

# 為什麼 CPU 計算慢時，不一定要增加 Thread？

## 30 秒判斷

先問：你慢的原因是哪個？

- **在等設備、網路、檔案**：這時問題是工作被等待卡住；處理重疊、非同步 I/O 等方式值得先檢查。
- **每筆訊息都在做大量 Python 計算**：例如跑很大的 Python 迴圈。這時你需要檢查能不能真的用多個 CPU 核心算。

在 ROS 2 Jazzy 常見的 CPython 執行環境中，有個 **GIL** 限制：同一個 Python Interpreter 裡，多條 Thread 通常不能同時執行純 Python 位元碼。所以把同一個大迴圈丟給兩條 Thread，不能直接推論計算時間會減半。

`Process` 則是另外一個 Python 執行程序，有自己的 Interpreter。你可以把大計算拆給兩個 Process 去跑，讓兩個核心都參與運算。**但是**，主程式要把資料傳過去，結果還要傳回來，而且每個 Process 都要吃記憶體。若每件工作只有一點點運算，傳輸成本反而可能比計算還高。 <https://docs.python.org/3.12/library/threading.html>、<https://docs.python.org/3.12/library/concurrent.futures.html>

## 原本與修改後發生什麼事？

原本：

```text
ROS 訊息到 → Callback 裡執行大迴圈 → 等計算結束 → 才處理其他 Callback
```

修改後（只是設計方向，是否適用要先驗證）：

```text
ROS 訊息到 → Callback 把「數字或可序列化資料」交給 Process Pool → Callback 很快返回
                                                  ↓
                                獨立 Process 做計算
                                                  ↓
                        主 ROS Node 非阻塞地取得結果並發布
```

**關鍵差別**：原本 ROS Callback 自己算完才返回；現在它只提交工作，結果可能晚一點才出現。這會影響輸出時間，任務也可能亂序完成。如果題目要求每筆輸出必須嚴格照順序，就需要保存序號並按序送出，不能直接丟出去。

## 一個最小的 Python 示範

下面程式可獨立用標準 Python 執行，目的是解釋 ProcessPoolExecutor 的基本運作；**它不是完整 ROS Node，也沒有實測速度**。

```python
from concurrent.futures import ProcessPoolExecutor
from multiprocessing import get_context


def heavy(n):  # 必須是模組最外層函式，不能直接傳 Node 進去
    return sum(i * i for i in range(n))


def main():
    with ProcessPoolExecutor(
        max_workers=2, mp_context=get_context("spawn")
    ) as pool:
        future_a = pool.submit(heavy, 500_000)
        future_b = pool.submit(heavy, 600_000)
        print(future_a.result(), future_b.result())


if __name__ == "__main__":
    main()
```

### 你需要知道的新語法

`submit(heavy, 500_000)` 的意思是：「把 `heavy(500_000)` 交給工作程序執行」。它會先回傳一張代表未來結果的單子，叫 `Future`，不是立刻回傳整數結果。等你呼叫 `future.result()`，如果還沒算完，這行就會等它完成。

這裡的 `.result()` 放在獨立示範的 `main()` 中，**不能照抄到 ROS Callback 裡面**。因為如果 Callback 提交工作後馬上 `.result()` 等待，Callback 還是一直卡著，不就回到原本的問題了？

`get_context("spawn")` 是讓 Python 用新的程序啟動工作者，而不是把目前已有 ROS 執行緒和狀態的程序直接 fork 過去。代價是啟動比較花時間，也要能重新 import 主模組，所以有 `if __name__ == "__main__":` 這個保護。

## 接到 ROS 專案應該怎麼處理？

這裡比上面單純呼叫 Process 更難，不能看到 `ProcessPoolExecutor` 就直接套用。

1. **主程序保留 ROS Node、Publisher、Subscriber 和 Executor**，不要把整個 Node 當參數交給 worker。工作函式只收普通 Python 資料（數字、字串、可序列化的資料結構）。
2. ROS Callback 收到訊息，只做必要的輸入整理和 `submit()`，然後返回。**不要在 Callback 裡用 `future.result()` 等結果。**
3. 留一個待完成工作清單，使用另一個短 Timer 週期檢查 `future.done()`，只有完成的才呼叫 `result()`。這樣不會在 callback 中等待尚未完成的工作。結果例外要捕捉。
4. **限制同時待處理的工作數**。如果新訊息每秒 1000 筆，但 worker 只能處理 200 筆，無限制排隊只會把 RAM 撐大，最後延遲更嚴重。滿載時要明確決定：拒收、合併、延後，或維持舊架構，不能默默丟資料。
5. 如果輸出有順序要求，要用序號記住每筆輸入的原始順序，處理好結果晚到、超時、失敗等情況；不然資料正確但順序錯，仍是程式錯誤。
6. 程序退出時，工作池要正常關閉；如果反覆建立工作池，可能反而吃掉大量 CPU 與記憶體。

這些步驟需要依照**考場真正的專案**安排。資料包沒有假造一份萬用的 ROS ProcessPool 修補程式，因為每個題目的資料型態、發布方式、順序需求都不同。

## 實際怎麼測？

先固定一批代表性輸入，至少包含小任務和大任務。比較原版及 Process 版：

- **正確性**：同一份輸入得到相同輸出，順序要求是否維持？任務失敗、例外和停止時能否正常處理？
- **吞吐量**：固定一段時間能完整處理多少筆，注意只計算真的完成並發布的結果。
- **端到端延遲**：每筆從收到訊息到結果發布花多久？看平均和尾部較慢的結果，不能只看最快的一筆。
- **CPU 使用**：觀察主程序與子程序合計消耗；只看主程序 CPU 會把 worker 成本漏掉。
- **記憶體**：觀察主程序加上子程序的總量與高峰值，不能只看主程序 RAM。

如果大任務吞吐提高、輸出一致，且 CPU／RAM 還在可接受範圍，這個方案才值得保留。如果小任務變慢、排隊增加或 RAM 太高，維持原先簡單版本往往更好。

## 不要直接用的情況

- 大部分時間是 I/O 等待，不是純 Python CPU 計算。
- 每個工作太短，程序間來回傳資料比計算更貴。
- 必須傳很大的物件，或函式與 ROS Node／硬體狀態緊密耦合。
- 題目的記憶體限制嚴格，或者實際平台沒有合適的多核心 CPU。
- 無法保證正確結果、輸出順序、工作失敗後的處理。

**查證狀態**：原理參考 Python 3.12 官方文件；以上範例未在成大考場及 ROS 2 Jazzy 環境實測；沒有虛構任何吞吐、CPU、RAM 改善數字。

參考：[Python 3.12 threading](https://docs.python.org/3.12/library/threading.html)、[Python 3.12 ProcessPoolExecutor](https://docs.python.org/3.12/library/concurrent.futures.html)。
