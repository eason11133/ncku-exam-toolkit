---
id: ops-ros2-environment
title: ROS 2：環境、Node／Topic、QoS 排查順序
category: 操作與除錯
tags: ROS 2,ros2 topic,ros2 node,QoS,setup.bash
aliases: ros2 command not found,Topic 沒訊息,Node 不見,source,ros2 topic hz
difficulty: beginner
priority: P0
source_type: personal
source_url: https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html
verified: false
updated_at: 2026-11-13
summary: 先確認 ROS 環境和 Topic 的實際 Type／QoS，再分析傳輸或 Callback。
related: ncku-ros2-cli-workflow,ncku-ros2-qos
---

# 先檢查 Shell 與 ROS 2 環境

ROS 2 命令要在有安裝 ROS 2 並已載入環境的 Shell 裡執行。在 Docker Container 裡開的第二個 Shell，可能也需要 source 對應 setup 檔。**不要硬把發行版寫死成 jazzy**：先看映像檔、`/opt/ros/` 和專案說明。

```bash
ls /opt/ros
# 有對應版本的 setup.bash 時再 source：
# source /opt/ros/實際版本/setup.bash
ros2 --help
ros2 node list
ros2 topic list -t
```

上面的 source 路徑含佔位符，**不是要照字面執行**。

## 容器／不同終端機：先查 `ROS_DOMAIN_ID`

在兩邊 Shell 分別執行 `printf 'domain=%s\n' "${ROS_DOMAIN_ID:-<unset>}"`，確認參與通訊的節點使用相同 Domain 設定。不同 Domain 的節點可能不會互相發現。這是查環境，不是叫你把所有人的 Domain 隨意改成 0；同時還要確認發現範圍與網路設定。

## Topic 沒資料時

```bash
ros2 topic info /topic_name -v
ros2 topic echo /topic_name
ros2 topic hz /topic_name
```

這裡的 `/topic_name` 要換成實際名稱。Topic 名稱相同還不夠，還要確認 message type、發送者／接收者數量、QoS 是否相容。若 Topic 能 echo，仍不代表下游處理一定正確。`topic hz` 是命令端觀察到的頻率，可能受網路、QoS 和 CLI 負載影響，不能當發送端的絕對基準。

## 分辨 ROS 通訊問題與效能問題

- **收不到資料**：先查 Node、Topic、Type、QoS，再看程式輸出。
- **收得到但延遲**：量測 Callback 處理時間、佇列、Executor 排程與資料量。
- **改了 Publisher 頻率**：需確認 Subscriber 能跟上；單靠提高發送頻率不等於速度改善。

參考：[ROS 2 Jazzy QoS](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)、[ROS 2 CLI](https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools.html)。
## 為什麼「明明有 ROS 2」但這個視窗找不到 `ros2`？

每開一個 Shell，它只會繼承自己的環境變數。你在第一個 Shell 執行過 `source /opt/ros/jazzy/setup.bash`，**第二個 Shell 不會自動得到同樣的設定**。`source` 的意思是讓目前這個 Shell 讀入設定；它不是安裝指令。

按照順序查，先不要重裝：

```bash
pwd
printf 'ROS_DISTRO=%s\n' "${ROS_DISTRO:-<unset>}"
command -v ros2
ls -ld /opt/ros/jazzy 2>/dev/null || true
```

如果 `/opt/ros/jazzy` 存在、`ros2` 卻找不到，再在該 Shell 執行 `source /opt/ros/jazzy/setup.bash` 並重試。若是在 Docker 內，先確認你進到的是包含 Jazzy 的那個容器。沒有 `ros2` 指令，和「有 ROS 2 但端點互相看不到」是兩種問題。

### `/number` 出現了但沒有任何數字

先看 `ros2 topic list -t`：只出現名稱，代表你找得到某個 Topic；不代表 Publisher 正在產生資料。接著 `ros2 topic info /number -v` 看 Publisher / Subscription、型別、QoS，最後再用 `ros2 topic echo /number` 看真正的 payload。

要注意 `ros2 topic echo` 自己也是一個 Subscriber。當 CLI 使用的 QoS 不相容時，它也可能看不到資料。不要只看一個指令就直接宣判 Python 程式壞掉。

**練習：** 在 A Shell `ROS_DOMAIN_ID=10`，B Shell `ROS_DOMAIN_ID=11`，即使兩邊名字都叫 `/number`，正常情況下也不會跨 Domain 自動互通。先讓兩端設定一致，再查名稱與 QoS。
