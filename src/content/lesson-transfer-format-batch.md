---
id: lesson-transfer-format-batch
title: 在允許延遲條件下批次處理
category: Performance Engineering
tags: serialization, 資料表示／傳輸格式選擇, 效能優化
aliases: batch, transfer-format
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html
verified: false
updated_at: 2026-11-12
summary: 多筆合成一次傳輸可攤薄固定成本，但等待批次會增加延遲。
related: ncku-binary-packet-parsing
---

# 在允許延遲條件下批次處理

## 先弄懂這個問題

目前的方法是 **資料表示／傳輸格式選擇**。要優化整體系統，除了演算法，也要留意資料格式、序列化與接收處理成本。

這個方案的目的是：固定傳輸開銷可由多筆共同分擔。

你可以先想像這個情境：每筆資料都觸發一次昂貴的傳送呼叫。

## 修改前：先看哪裡有問題

```python
for sample in samples:
    send([sample])
```

這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。

## 修改後：對照實作

```python
batch = []
for sample in samples:
    batch.append(sample)
    if len(batch) >= 32:
        send(batch)
        batch = []
if batch:
    send(batch)      # 不漏最後不足 32 筆
```

## 逐步理解，為什麼這樣改

批次會減少呼叫次數，但最早進入批次的資料必須等到滿 32 筆才送出。即時系統還要另外設定最大等待期限，不能只靠大小門檻。

不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。

## 什麼情況才適合

- 資料可分批
- 可接受額外等待與部分訊息延後

## 常見錯誤與代價

- 延遲可能變差
- 出錯時重送／回復更複雜

**正確性界線：**依相同負載量測 throughput 及 p95 延遲，不能只看吞吐量。

## 怎麼做測試

核對送出總筆數及順序；在高流量與低流量分別測吞吐和 p95 延遲。

優先觀察：throughput、p95、CPU、bytes。每次都要保留舊版結果做對照。單次跑得快不能證明方案有效；輸出錯了更不能算優化成功。

## 考場快速判斷

看到 **payload too large** 或 **不必要的大欄位** 時，可以把這個方案列為候選，但先確認實際程式是否符合上面的前提。若題目沒有對應瓶頸，就不要為了套用方案而改動架構。

## 參考文件與驗證狀態

- [ROS 2 Jazzy Topic CLI](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html)

這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。
