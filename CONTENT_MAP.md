# 內容地圖

| 官方 Demo／用途 | 核心教學（Markdown） | 效能優化搜尋條目（JSON） |
|---|---|---|
| 2-1 ROS 2 Node／Topic／CLI | `ncku-ros2-cli-workflow.md`、`ncku-debug-decision-tree.md` | `ros2-topic-pipeline.json` |
| 2-1 延伸：Executor、Callback | `ncku-ros2-executor.md`、`ros2-ste-*.md` 三篇 | `single-threaded-executor.json`、`ros2-processing-callback.json`、`python-cpu-process.json` |
| 2-1 延伸：QoS、資料格式 | `ncku-ros2-qos.md` | `ros2-qos-profile.json`、`transfer-format.json` |
| 2-2 位元運算 | `ncku-bitwise-c.md`、`ncku-c-language-bridge.md` | `c-bitfield-operations.json` |
| 2-2 PIO、RP2350 | `ncku-pio-dataflow.md`、`ncku-embedded-riscv-io.md` | `rp2350-pio-fifo.json` |
| 2-3 pthread、臨界區 | `ncku-pthread-critical-section.md`、`ncku-concurrency-advanced.md` | `spinlock-critical-section.json`、`pthread-work-partition.json` |
| 2-3 Transfer Engine | `ncku-transfer-engine.md`、`ncku-c-memory.md` | `transfer-engine-configuration.json`、`memory-buffer-copy.json` |
| 系統負載、buffer、管線 | `ncku-systems-foundations.md` | `resource-queues.json` |
| 效能驗證 | `ncku-performance-benchmark.md` | `benchmark-correctness.json` |
| 開發工具 | `ncku-docker-debug.md`、`ncku-gitlab-workflow.md`、`ncku-local-llm-prompts.md` | 現有網站的指令速查／個人筆記可配合使用 |

四張 SVG：

- `single-threaded-executor.svg`：A 執行時 B 等待；採精簡時間軸，不加裝飾。
- `pio-echo-flow.svg`：CPU → TX FIFO → OSR → X → ISR → RX FIFO → CPU。
- `race-condition.svg`：A、B 都讀到 5，最後寫回 6，少一次更新。
- `transfer-engine-flow.svg`：設定 → 啟動 → 等待 → 讀結果／釋放。

## 先後查找順序

先用使用者看到的**症狀**查找（例如「B 反應慢」「FIFO 卡住」「count 搞混」「鎖競爭」），再讀對應方法／方案的前提、程式碼及驗證方法。沒有真的跑過的方案不得標記效能已改善。
