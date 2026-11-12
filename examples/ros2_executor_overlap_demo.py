"""ROS 2 Jazzy / rclpy 教學範例。未在 ROS 2 環境實際執行。

Usage:
  source /opt/ros/jazzy/setup.bash
  python3 ros2_executor_overlap_demo.py single
  python3 ros2_executor_overlap_demo.py multi
"""
import sys
import time

import rclpy
from rclpy.callback_groups import MutuallyExclusiveCallbackGroup
from rclpy.executors import MultiThreadedExecutor, SingleThreadedExecutor
from rclpy.node import Node


class OverlapDemo(Node):
    def __init__(self):
        super().__init__("overlap_demo")
        self.start_time = time.perf_counter()
        # 保存 group 參照；兩個 timer 分配到不同互斥群組
        self.group_a = MutuallyExclusiveCallbackGroup()
        self.group_b = MutuallyExclusiveCallbackGroup()
        self.timer_a = self.create_timer(0.8, self.callback_a, callback_group=self.group_a)
        self.timer_b = self.create_timer(0.1, self.callback_b, callback_group=self.group_b)

    def log(self, message):
        elapsed = time.perf_counter() - self.start_time
        self.get_logger().info(f"{elapsed:7.3f}s {message}")

    def callback_a(self):
        self.log("A start")
        time.sleep(0.35)  # 人為模擬 I/O 等待，不是效能改善方法
        self.log("A end")

    def callback_b(self):
        self.log("B run")


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"single", "multi"}:
        print("Usage: python3 ros2_executor_overlap_demo.py [single|multi]")
        raise SystemExit(2)
    rclpy.init()
    node = OverlapDemo()
    executor = (
        MultiThreadedExecutor(num_threads=2)
        if sys.argv[1] == "multi"
        else SingleThreadedExecutor()
    )
    executor.add_node(node)
    try:
        executor.spin()
    except KeyboardInterrupt:
        pass
    finally:
        executor.shutdown()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
