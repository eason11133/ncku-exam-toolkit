---
id: ncku-transfer-engine
title: Transfer Engine 與 DMA：count、size、increment、channel
category: DMA
tags: transfer engine, DMA, channel, data size, increment, alignment, memory copy
aliases: 資料搬運引擎, copy, fill, engine_job_t, 來源位址遞增
difficulty: advanced
priority: P0
source_type: personal
source_url: https://www.raspberrypi.com/documentation/pico-sdk/hardware.html
verified: false
updated_at: 2026-11-12
summary: 檢查資料搬運描述、傳輸單位、位址遞增、通道生命週期與 CPU/硬體成本差別。
related: ncku-pthread-critical-section, ncku-pio-dataflow
---
# Transfer Engine：先描述工作，再啟動

官方 2-3 Transfer Engine 是用**軟體執行緒模擬**的搬運引擎，不是真正的硬體 DMA。因此 `engine_start()` 之後主程式仍能做事，可以示範非同步流程，但不能說引擎不佔 CPU。


## `engine_job_t` 主要欄位

| 欄位 | 代表什麼 | 常見錯誤 |
|---|---|---|
| `src` | 從哪個位址讀 | 指到錯誤／已釋放的來源記憶體 |
| `dst` | 寫入哪個位址 | 空間不足或覆蓋仍在使用的資料 |
| `count` | **幾筆傳輸**，不是位元組數 | `4096 * 4` 誤填成 count 造成越界 |
| `size` | 每筆 1、2、4 bytes | 超出支援值或地址沒有正確對齊 |
| `src_increment` | 每筆後來源位址是否往前 | 填值應固定來源，卻誤設為遞增 |
| `dst_increment` | 每筆後目的位址是否往前 | 連續寫出卻忘了遞增 |

傳輸位元組總數：`count * size`。例如 4096 筆、每筆 4 bytes，就是 16384 bytes。只有 buffer 足夠大、乘法不 overflow、位址合法時才能執行。

## 正確使用節奏

```c
int ch = engine_claim();            // 取得通道
if (ch < 0) { /* 無可用通道：處理錯誤 */ }
engine_configure(ch, &job);          // src / dst / count / size / flags
engine_start(ch);                    // 開始，立即返回
// 此時可做無關工作，但不得任意更動正在搬的來源/目的資料
engine_wait(ch);                     // 等傳輸完成
// 現在才讀 dst / 釋放被搬運的 buffer
engine_release(ch);                  // 歸還通道
```

上面是**概念片段**，要搭配官方的 `engine.h` 和錯誤處理。若 claim 失敗不能繼續 configure；若 configure 失敗要依 API 的行為清理。

## Copy 和 Fill 的差別

```text
COPY：src = [a,b,c,d], dst = [_,_,_,_]，src_increment=true，dst_increment=true
FILL：src = [0xA5A5...], dst = [_,_,_,_]，src_increment=false，dst_increment=true
```

如果把填值模式的 `src_increment` 改成 true，會從原始值後方讀取可能不存在的資料。若想處理兩個互相重疊的 buffer，普通 copy/DMA 也不能自動假設具備 `memmove` 的安全行為。

## `make mistake` 在警告什麼

官方引擎只支援 1、2、4 bytes 的 `size`，並要求地址對齊；`count` 是筆數。如果把要搬的**總 bytes** 當成筆數，會要求多搬幾倍資料，可能造成越界或其他錯誤。某些硬體可能直接寫壞相鄰記憶體，不能靠測一次沒壞就認為安全。

```bash
cd /demo/section2-3
make run-transfer-engine
make mistake
```

## 怎麼判斷 DMA 類型優化值不值得

真正的 DMA 用專用硬體搬資料，能讓 CPU 去做其他工作，但搬運仍占匯流排、記憶體頻寬，配置／啟動也有成本；小量資料可能不如 `memcpy`。要量測 CPU 可用時間、整體延遲、吞吐量、正確性；不能拿官方軟體引擎的單次速度代表硬體 DMA。

來源：[Pico SDK DMA](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_dma)、[Pico SDK dma.h](https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/hardware_dma/include/hardware/dma.h)。
