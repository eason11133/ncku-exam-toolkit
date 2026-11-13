"""Executable counterexamples for the current A1-A9 correction batch."""
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'src/content'
CC = os.environ.get('CC') or shutil.which('gcc')
if not CC:
    raise SystemExit('GCC required: set CC')

def blocks(article, language):
    text = (CONTENT / f'{article}.md').read_text(encoding='utf-8')
    return re.findall(r'(?m)^```' + language + r'\n(.*?)^```', text, re.S)

def run(command, *, expect_success=True, cwd=None):
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, timeout=20)
    if (result.returncode == 0) != expect_success:
        raise RuntimeError(f'{command}: exit={result.returncode}\n{result.stdout}\n{result.stderr}')
    return result

with tempfile.TemporaryDirectory(prefix='ncku-known-fixes-') as directory:
    temp = Path(directory)
    c_cases = [
        ('opt-transfer-unit-capacity', 0),
        ('opt-transfer-unit-capacity', 1),
        ('opt-transfer-no-channel-fallback', 0),
        ('ncku-v2-c-signed-overflow', 0),
        ('opt-pthread-stop-broadcast', 0),
        ('opt-cond-bounded-ring', 0),
    ]
    for article, index in c_cases:
        source = temp / f'{article}-{index}.c'
        source.write_text(blocks(article, 'c')[index], encoding='utf-8')
        for setting, flags in [('O0', ['-O0']), ('O2', ['-O2']), ('NDEBUG', ['-O2', '-DNDEBUG'])]:
            binary = temp / f'{article}-{index}-{setting}.exe'
            run([CC, '-std=c11', '-Wall', '-Wextra', '-Werror', '-pedantic', '-pthread', *flags, str(source), '-o', str(binary)])
            run([str(binary)])
    # The fault-injection fixture models a failed second create and a failed first join.
    fixture = ROOT / 'tests/thread_failure_paths.c'
    for setting, flags in [('O0', ['-O0']), ('O2', ['-O2']), ('NDEBUG', ['-O2', '-DNDEBUG'])]:
        binary = temp / f'thread-failure-{setting}.exe'
        run([CC, '-std=c11', '-Wall', '-Wextra', '-Werror', '-pedantic', '-pthread', *flags, str(fixture), '-o', str(binary)])
        run([str(binary)])
    for article, index in [('opt-ros2-service-request-state-machine', 0), ('opt-ros2-parameterize-knobs', 1)]:
        code = blocks(article, 'python')[index]
        for flags in ([], ['-O']):
            run([sys.executable, *flags, '-c', code])
    # An intentionally wrong invariant must fail even when Python disables assert.
    mutation = 'value=2\nif not (value==1): raise RuntimeError("wrong")\nprint("PASS")'
    for flags in ([], ['-O']):
        result = run([sys.executable, *flags, '-c', mutation], expect_success=False)
        if 'PASS' in result.stdout:
            raise RuntimeError('false PASS escaped')
    shell = blocks('opt-c-compare-optimization-levels', 'bash')[0]
    if not re.search(r'(?m)^set -eu$', shell):
        raise RuntimeError('Shell comparison has no fail-fast rule')
    bash = shutil.which('bash')
    if bash:
        result = run([bash, '-c', 'set -eu; false; echo SHOULD_NOT_PRINT'], expect_success=False)
        if 'SHOULD_NOT_PRINT' in result.stdout:
            raise RuntimeError('Shell continued after failure')
    else:
        print('SKIP: Bash runtime unavailable; set -eu checked statically')

print('PASS: A1/A2/A3/A4/A5/A7/A8/A9 counterexamples and corrected paths')
