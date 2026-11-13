---
id: opt-ros2-service-request-state-machine
title: 服務要等多個事件時，拆成可追蹤狀態機
category: ROS 2
tags: ROS 2, ros2-service-client-deadlock, 考場判讀
aliases: opt-ros2-service-request-state-machine, 服務要等多個事件時，拆成可追蹤狀態機
difficulty: intermediate
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Tutorials/Beginner-Client-Libraries/Writing-A-Simple-Py-Service-And-Client.html
verified: false
updated_at: 2026-11-13
summary: 非同步 service request 要管理結果、超時、重試及重複回覆。
related: ncku-v2-ros2-service-client-deadlock
---

# 服務要等多個事件時，拆成可追蹤狀態機

## 不應直接在 callback 內等到結果

如果 Service 跨多個 callback／Topic 才能完成，把「等待」改成狀態：`idle -> pending -> done/failed/timeout`。每個 request 要有 ID 和 Deadline；失敗重試不能不問下游是否已完成原操作，否則可能重複執行。

## 純 Python 狀態機（不含 ROS 2）

<!-- test: full-python -->
```python
states={}
def start(req_id,deadline):
    if req_id in states: return False
    states[req_id]={'status':'pending','deadline':deadline}
    return True
def complete(req_id,now):
    x=states.get(req_id)
    if not x or x['status']!='pending' or now>x['deadline']: return False
    x['status']='done'; return True
def expire(now):
    for x in states.values():
        if x['status']=='pending' and now>=x['deadline']:
            x['status']='timeout'
assert start('a',5)
assert not start('a',5)
assert complete('a',3) and not complete('a',4)
assert start('b',5)
expire(5)
assert states['b']['status']=='timeout'
print(states)
```

這個小例子僅示範狀態轉移規則，**不是 rclpy 可直接跑的 Service Server**。實際實作還需要 thread safety、request/result 的序列化、取消規則及 timeout 後才到達的 response 處理；不能只因 `Future.done()` 回傳成功就保證下游永遠沒有重複副作用。

**驗收**：重複 ID、亂序完成、逾時後完成、連續重試、shutdown 時 pending 任務，確認一次性語意與資源清理策略。

## 來源與驗證界線

- 參考：https://docs.ros.org/en/jazzy/Tutorials/Beginner-Client-Libraries/Writing-A-Simple-Py-Service-And-Client.html
- 這是尚未匯入 Preview 的離線候選教材。完整 C／Python 範例必須通過本機測試；ROS 2、PIO、RP2350、效能或實際考場表現都需要目標環境另外驗證，不能以文字或模型試算代替。


---

## 深讀練習：用一組資料確定自己會了（v7）

## 變形題：結果到達時，請求已經逾時

原文的狀態機能防止完成同一個 request 兩次，但真正 Service 可能在你宣告 timeout 後才傳回 response。因此 **timeout 是你不再等待，不一定等於對方取消成功**。若操作會轉帳或修改設備狀態，不能一超時就盲目重試。

<!-- v7-test: full-python -->
```python
requests = {'r7': {'state':'pending','deadline':5}}

def on_clock(req_id, now):
    r = requests[req_id]
    if r['state']=='pending' and now >= r['deadline']:
        r['state']='timeout'

def on_reply(req_id, result):
    r = requests[req_id]
    if r['state']!='pending':
        return 'late/duplicate: investigate before retry'
    r['state']='done'
    r['result']=result
    return 'accepted'

on_clock('r7', 6)
assert on_reply('r7', 'ok') == 'late/duplicate: investigate before retry'
assert requests['r7']['state'] == 'timeout'
print('late reply handled')
```

這是純 Python 決策模型，不是真正發送 ROS 2 Service。需要一次且僅一次的副作用時，還得看 Server 是否支援請求 ID 去重、查詢狀態及安全的重試設計。
