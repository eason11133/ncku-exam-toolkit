"""Audit C fences and compile examples explicitly presented as complete programs.

Run with: python checks/compile_c_examples.py
Set CC to a GCC executable if gcc is not on PATH.
"""

from pathlib import Path
import os
import re
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "src" / "content"
FULL_LABEL = "完整 C11 程式"


def run(command: list[str], quiet: bool = False) -> None:
    subprocess.run(command, check=True, cwd=ROOT, stdout=subprocess.DEVNULL if quiet else None)


def main() -> int:
    compiler = os.environ.get("CC") or shutil.which("gcc")
    if not compiler:
        print("FAIL: GCC not found; set CC to a GCC executable", file=sys.stderr)
        return 1

    fences: list[tuple[Path, int, str, bool]] = []
    for article in sorted(CONTENT.glob("*.md")):
        source = article.read_text(encoding="utf-8")
        for number, match in enumerate(re.finditer(r"```c\r?\n(.*?)\r?\n```", source, re.S), 1):
            preface = source[max(0, match.start() - 240):match.start()]
            full = FULL_LABEL in preface
            fences.append((article, number, match.group(1), full))

    full_examples = [entry for entry in fences if entry[3] or "int main(" in entry[2]]
    if len(full_examples) < 2:
        raise RuntimeError("Expected the two corrected complete C examples")

    with tempfile.TemporaryDirectory(prefix="ncku-c-examples-") as directory:
        temp = Path(directory)
        for article, number, source, labeled in full_examples:
            c_file = temp / f"{article.stem}-{number}.c"
            executable = temp / f"{article.stem}-{number}.exe"
            c_file.write_text(source + "\n", encoding="utf-8")
            run([compiler, "-std=c11", "-Wall", "-Wextra", "-Werror", "-pedantic", str(c_file), "-pthread", "-o", str(executable)])
            run([str(executable)], quiet=True)
            grade = "labeled complete" if labeled else "standalone main"
            print(f"PASS ({grade}): {article.relative_to(ROOT)} C block {number} compiled and ran")

        for example in sorted((ROOT / "examples").glob("*.c")):
            executable = temp / f"external-{example.stem}.exe"
            run([compiler, "-std=c11", "-Wall", "-Wextra", "-Werror", "-pedantic", str(example), "-pthread", "-o", str(executable)])
            run([str(executable)], quiet=True)
            print(f"PASS (linked complete file): {example.relative_to(ROOT)} compiled and ran")

        atomic_article = CONTENT / "ncku-v2-pthread-atomic-counter.md"
        atomic = next((entry for entry in fences if entry[0] == atomic_article), None)
        if atomic is None:
            raise RuntimeError("C11 atomic function snippet is missing")
        c_file = temp / "atomic-counter.c"
        c_file.write_text(atomic[2] + "\n", encoding="utf-8")
        run([compiler, "-std=c11", "-Wall", "-Wextra", "-Werror", "-pedantic", "-fsyntax-only", str(c_file)])
        print("PASS: C11 atomic function snippet passed GCC syntax check")

    print(f"Audited {len(fences)} C blocks: {len(full_examples)} standalone complete programs compiled and ran; {len(fences) - len(full_examples)} context-dependent snippets not compiled as standalone programs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
