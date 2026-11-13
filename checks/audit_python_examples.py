"""Run the self-contained, marked Python lessons in normal and optimized modes."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FENCE = re.compile(r'<!-- test: full-python -->\s*```python\n(.*?)^```', re.M | re.S)
checked = 0
for article in sorted((ROOT / 'src/content').glob('*.md')):
    for index, match in enumerate(FENCE.finditer(article.read_text(encoding='utf-8'))):
        code = match.group(1)
        if re.search(r'(?m)^\s*assert\b', code):
            raise SystemExit(f'{article.name}:{index}: assert disappears under python -O')
        for flags in ([], ['-O']):
            run = subprocess.run([sys.executable, *flags, '-c', code], capture_output=True, text=True, timeout=15)
            if run.returncode:
                raise SystemExit(f'{article.name}:{index} {flags}: {run.stderr or run.stdout}')
            checked += 1

# The mutation must fail in both modes even if it prints a plausible PASS line.
bad = 'value = 2\nif not (value == 1): raise RuntimeError("wrong value")\nprint("PASS")'
for flags in ([], ['-O']):
    run = subprocess.run([sys.executable, *flags, '-c', bad], capture_output=True, text=True)
    if run.returncode == 0 or 'PASS' in run.stdout:
        raise SystemExit(f'fault injection escaped with {flags}')

print(f'PASS: {checked} marked Python executions; -O mutation rejected')
