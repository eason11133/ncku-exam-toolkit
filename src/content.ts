import { z } from 'zod'

export const categoryTree = [
  { name: 'Systems', children: ['Linux & Shell', 'Docker', 'Git & GitLab', 'C Programming', 'Memory Management', 'Debugging'] },
  { name: 'Embedded', children: ['Embedded Systems', 'RP2040 / RP2350', 'ESP32', 'RISC-V', 'PIO', 'GPIO', 'UART / SPI / I²C', 'DMA'] },
  { name: 'Concurrency', children: ['pthread', 'Mutex / Spinlock', 'Concurrency'] },
  { name: 'Workflow', children: ['ROS 2', 'Performance Engineering', 'Benchmarking', 'AI-Assisted Development', 'Exam Practice Scenarios'] },
]

const base = z.object({
  id: z.string().min(1), title: z.string().min(1), category: z.string().min(1),
  tags: z.array(z.string()).default([]), aliases: z.array(z.string()).default([]),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  priority: z.enum(['P0', 'P1', 'P2']).default('P1'),
  source_type: z.enum(['official', 'community', 'personal', 'speculative']),
  source_url: z.string().url().optional(), verified: z.boolean(),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), summary: z.string(),
  related: z.array(z.string()).default([]), body: z.string(),
})
export type Article = z.infer<typeof base>

const jsonModules = import.meta.glob('./content/*.json', { eager: true, import: 'default' })
const markdownModules = import.meta.glob('./content/*.md', { eager: true, query: '?raw', import: 'default' })

function parseMarkdown(raw: string): unknown {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) throw new Error('Markdown requires YAML front matter')
  const metadata: Record<string, unknown> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([a-z_]+):\s*(.*)$/)
    if (!pair) continue
    const value = pair[2].trim()
    metadata[pair[1]] = ['tags', 'aliases', 'related'].includes(pair[1])
      ? (value ? value.split(',').map(item => item.trim()) : [])
      : value === 'true' ? true : value === 'false' ? false : value
  }
  return { ...metadata, body: match[2] }
}

export const articles: Article[] = Object.entries({ ...jsonModules, ...Object.fromEntries(Object.entries(markdownModules).map(([path, raw]) => [path, parseMarkdown(raw as string)])) })
  .map(([path, value]) => {
    const result = base.safeParse(value)
    if (!result.success) throw new Error(`Invalid content ${path}: ${result.error.message}`)
    return result.data
  })

export type Command = { id: string; title: string; category: string; summary: string; syntax: string; options: string[]; example: string; caution: string; related: string[]; source: string; aliases?: string[] }
export const commands: Command[] = [
  { id: 'ls', title: 'ls', category: 'Linux & Shell', summary: '列出目錄內容。', syntax: 'ls [OPTION]... [FILE]...', options: ['-l：長格式', '-a：包含隱藏項目'], example: 'ls -la', caution: '輸出順序與顏色會因環境設定而不同。', related: [], source: 'https://www.gnu.org/software/coreutils/manual/html_node/ls-invocation.html' },
  { id: 'docker-exec', title: 'docker exec', category: 'Docker', summary: '在執行中的容器裡執行命令。', syntax: 'docker exec [OPTIONS] CONTAINER COMMAND [ARG...]', options: ['-i：保持 STDIN 開啟', '-t：配置 pseudo-TTY'], example: 'docker exec -it my-container sh', caution: '容器必須正在執行；映像可能沒有 bash，改用 sh。', related: ['docker-ps'], source: 'https://docs.docker.com/reference/cli/docker/container/exec/', aliases: ['container shell'] },
  { id: 'docker-ps', title: 'docker ps', category: 'Docker', summary: '列出執行中的容器。', syntax: 'docker ps [OPTIONS]', options: ['-a：包含已停止的容器'], example: 'docker ps -a', caution: '預設只顯示執行中的容器。', related: ['docker-exec'], source: 'https://docs.docker.com/reference/cli/docker/container/ls/' },
  { id: 'git-status', title: 'git status', category: 'Git & GitLab', summary: '檢查工作樹與暫存區狀態。', syntax: 'git status [OPTIONS]', options: ['--short：精簡顯示'], example: 'git status --short', caution: '執行前先確認目前的 Repository。', related: ['git-diff'], source: 'https://git-scm.com/docs/git-status' },
  { id: 'git-diff', title: 'git diff', category: 'Git & GitLab', summary: '檢視尚未提交的差異。', syntax: 'git diff [OPTIONS]', options: ['--staged：檢查暫存區'], example: 'git diff --staged', caution: '預設不顯示已加入暫存區的變更。', related: ['git-status'], source: 'https://git-scm.com/docs/git-diff' },
  { id: 'glab-mr-list', title: 'glab mr list', category: 'Git & GitLab', summary: '列出 GitLab Merge Requests。', syntax: 'glab mr list [flags]', options: ['--all：包含關閉與已合併項目', '--assignee=@me：只列出指派給自己的項目'], example: 'glab mr list --assignee=@me', caution: '需要先安裝並登入 GitLab CLI；預設只顯示開啟中的 MR。', related: ['git-status'], source: 'https://docs.gitlab.com/cli/mr/list/' },
  { id: 'ros2-topic-list', title: 'ros2 topic list', category: 'ROS 2', summary: '列出目前活躍的 ROS 2 topics。', syntax: 'ros2 topic list [-t]', options: ['-t：同時顯示 message type'], example: 'ros2 topic list -t', caution: '先載入適用的 ROS 2 環境；結果取決於目前可發現的 nodes。', related: [], source: 'https://docs.ros.org/en/rolling/ROS-Framework/interfaces/topics/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html' },
  { id: 'gcc-warnings', title: 'gcc', category: 'C Programming', summary: '以常見警告選項編譯 C 程式。', syntax: 'gcc [OPTIONS] SOURCE -o OUTPUT', options: ['-Wall -Wextra：啟用多項警告', '-g：加入除錯資訊'], example: 'gcc -Wall -Wextra -g main.c -o app', caution: '警告選項不是完整的正確性檢查。', related: [], source: 'https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html' },
  { id: 'clang-warnings', title: 'clang', category: 'C Programming', summary: '使用 Clang 警告與除錯資訊編譯 C 程式。', syntax: 'clang [OPTIONS] SOURCE -o OUTPUT', options: ['-Wall -Wextra：啟用常用警告', '-g：加入除錯資訊'], example: 'clang -Wall -Wextra -g main.c -o app', caution: '編譯旗標應與實際目標平台和語言版本搭配。', related: ['gcc-warnings'], source: 'https://clang.llvm.org/docs/UsersManual.html' },
  { id: 'make-parallel', title: 'make -j', category: 'C Programming', summary: '平行執行 Makefile 中可並行的建置工作。', syntax: 'make -j [JOBS] [TARGET]', options: ['-j 4：最多同時執行 4 個 recipe'], example: 'make -j 4', caution: 'Makefile 的依賴關係必須正確，平行建置才能可靠。', related: ['gcc-warnings'], source: 'https://www.gnu.org/software/make/manual/html_node/Parallel.html' },
  { id: 'gdb-run', title: 'gdb', category: 'Debugging', summary: '啟動 GDB 除錯器。', syntax: 'gdb PROGRAM', options: ['執行前以 -g 編譯程式'], example: 'gdb ./app', caution: '載入程式後使用 run 開始執行。', related: ['gcc-warnings'], source: 'https://sourceware.org/gdb/current/onlinedocs/gdb.html/' },
  { id: 'perf-stat', title: 'perf stat', category: 'Performance Engineering', summary: '執行程式並收集效能計數器統計。', syntax: 'perf stat -- COMMAND [ARGS...]', options: ['-e EVENT：指定要測量的事件'], example: 'perf stat -- ./app', caution: '可用事件與權限依 Linux 核心和系統設定而異。', related: [], source: 'https://github.com/torvalds/linux/blob/master/tools/perf/Documentation/perf-stat.txt' },
]

export type DocLink = { id: string; title: string; category: string; summary: string; url: string; version: string; topics: string[]; checkedAt: string }
export const docs: DocLink[] = [
  { id: 'docker-docs', title: 'Docker CLI Reference', category: 'Docker', summary: '容器與映像命令的官方參考。', url: 'https://docs.docker.com/reference/cli/docker/', version: 'Online', topics: ['docker exec', 'docker ps'], checkedAt: '2026-11-09' },
  { id: 'git-docs', title: 'Git Reference', category: 'Git & GitLab', summary: 'Git 命令與選項參考。', url: 'https://git-scm.com/docs', version: 'Online', topics: ['git status', 'git diff'], checkedAt: '2026-11-09' },
  { id: 'gcc-docs', title: 'GCC Manual', category: 'C Programming', summary: '編譯器選項與診斷文件。', url: 'https://gcc.gnu.org/onlinedocs/', version: 'Online', topics: ['gcc', 'warnings'], checkedAt: '2026-11-09' },
  { id: 'pthread-docs', title: 'POSIX Threads', category: 'Concurrency', summary: 'POSIX 執行緒 API 規格入口。', url: 'https://pubs.opengroup.org/onlinepubs/9799919799/', version: 'Issue 8', topics: ['pthread', 'mutex'], checkedAt: '2026-11-09' },
  { id: 'ros-docs', title: 'ROS 2 Documentation', category: 'ROS 2', summary: 'ROS 2 官方概念、教學與 API 入口。', url: 'https://docs.ros.org/', version: 'Online', topics: ['ROS 2'], checkedAt: '2026-11-09' },
  { id: 'pico-docs', title: 'Raspberry Pi Documentation', category: 'RP2040 / RP2350', summary: 'Pico SDK 與晶片文件入口。', url: 'https://www.raspberrypi.com/documentation/microcontrollers/', version: 'Online', topics: ['RP2040', 'RP2350', 'PIO'], checkedAt: '2026-11-09' },
]

export const troubleshooting = [
  { id: 'docker-container-not-running', symptom: 'docker exec 顯示 container is not running', category: 'Docker', causes: ['目標容器已停止', '容器名稱輸入錯誤'], diagnostics: ['docker ps -a'], checks: ['確認容器狀態與名稱', '查看容器日誌'], fixes: ['依容器停止原因修正後重新啟動'], verification: ['docker ps'], source: 'https://docs.docker.com/reference/cli/docker/container/exec/' },
]

export const scenarios: { id: string; title: string; tier: 'official' | 'extension' | 'speculative'; summary: string }[] = []
