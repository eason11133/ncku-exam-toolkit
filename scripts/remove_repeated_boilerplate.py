"""Remove the exact repeated editorial paragraphs identified in the supplied review."""
from pathlib import Path

PARAGRAPHS = (
    "這段是**教學情境**，不代表所有考場程式都這樣寫。先理解它為什麼可能慢、可能錯或可能卡住。",
    "不要只記住程式碼。題目換了，先確認瓶頸是不是同一種，以及修改後有沒有改變輸出或執行順序。",
    "這篇是依照文件與教學情境撰寫，**尚未在指定考場環境實測**。ROS 2、PIO、DMA 相關片段若標示示意或使用未定義的函式，不能直接當成可編譯的完整專案。",
    "這是方便定位問題的最小示例或概念片段，不是完整專案替換檔。請先核對原專案使用的版本、API、資料格式與生命週期；不能只因範例看起來較快就直接複製到正式程式。",
    "修改結果請記錄同一份輸入的 **修改前輸出、修改後輸出、時間、CPU、記憶體、錯誤率**；沒有關係的指標可以標示「未量」，不要填想像的數值。測試前先保留原版以便回退。",
    "- 官方 Demo 若沒有相應環境或開發板，本篇不宣稱執行過硬體實測。",
    "- 本篇是技術解法資料，**不是官方考題或經過考場證實的加速結果**。",
)

if __name__ == "__main__":
    counts = {paragraph: 0 for paragraph in PARAGRAPHS}
    changed = 0
    for path in Path("src/content").glob("*.md"):
        original = path.read_text(encoding="utf-8")
        body = original
        for paragraph in PARAGRAPHS:
            count = body.count(paragraph)
            counts[paragraph] += count
            body = body.replace(paragraph + "\n\n", "").replace(paragraph + "\n", "")
        if body != original:
            path.write_text(body, encoding="utf-8")
            changed += 1
    print(f"Changed {changed} articles")
    for paragraph, count in counts.items():
        print(f"{count:3} × {paragraph[:48]}")
