---
id: opt-algo-binary-left-bound-c
title: 排序資料反覆查：二分找第一個大於等於目標的元素
category: Algorithms
tags: Algorithms, algorithm-search-batching, 考場判讀
aliases: opt-algo-binary-left-bound-c, 排序資料反覆查：二分找第一個大於等於目標的元素
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.python.org/3/library/bisect.html
verified: false
updated_at: 2026-11-13
summary: 用明確的 [lo,hi) 不變式處理重複值與邊界。
related: ncku-v2-algorithm-search-batching
---

# 排序資料反覆查：二分找第一個大於等於目標的元素

## 先確定資料已排序

把無序陣列直接拿來二分，不會因為程式沒當掉就正確。查詢型態要先說清楚：找第一個 `>= target`、最後一個 `<= target`、還是找任一相等位置？重複值時這三種結果不同。

## 完整 C11：lower_bound

<!-- test: full-c -->
```c
#include <stddef.h>
#include <stdio.h>
static size_t lower_bound(const int *a, size_t n, int target) {
    size_t lo=0, hi=n;
    while (lo < hi) {
        size_t mid=lo+(hi-lo)/2;
        if (a[mid] < target) lo=mid+1;
        else hi=mid;
    }
    return lo;
}
int main(void) {
    const int a[] = {1,3,3,3,8};
    if (lower_bound(a,5,3)!=1) return 1;
    if (lower_bound(a,5,4)!=4) return 2;
    if (lower_bound(a,5,9)!=5) return 3;
    if (lower_bound(a,0,3)!=0) return 4;
    puts("binary search ok");
    return 0;
}
```

這裡的區間採 `[lo,hi)`，`hi=n` 可以代表「不存在 >= target 的元素」。`mid=lo+(hi-lo)/2` 可避開 `lo+hi` 的加法溢位。若資料會持續插入，維持排序所需時間也必須算進整個方案。

**驗收**：空陣列、單一元素、重複、全部小於目標、全部大於目標，以及隨機排序數列與線性找第一個 >= 的結果比對。

## 來源與驗證界線

- 參考：https://docs.python.org/3/library/bisect.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。

## 延伸推演｜遇到變形題怎麼判斷

## 二分搜尋的 `lo/hi` 是一個範圍，不是猜測答案

對已排序 `[1,3,3,3,7]`，找第一個 `>=3` 的位置。開始 `lo=0, hi=5`，使用半開區間 `[lo,hi)`；每次取 `mid=lo+(hi-lo)/2`。若 `a[mid]>=3`，答案可能在 mid 或左邊，設 `hi=mid`；否則設 `lo=mid+1`。最後 `lo=1`。

若查 9，結果是 `lo=5`，這代表合法插入位置在陣列尾端，**不是**找到值；使用 `a[lo]` 前必須檢查 `lo<n`。遇到重複值時，找左邊界和右邊界的比較條件不同，不能只改一個 `<=` 卻不重新推演不變條件。

Python 的 `bisect_left` 和 C 手寫左邊界本質是在找同一種分界。若資料根本沒排序，兩者都不保證正確。插入有序陣列可能仍需搬移 O(N) 元素，二分 O(log N) 只描述找插入位置的比較次數。
