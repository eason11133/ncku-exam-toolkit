import { z } from 'zod'

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
  { id: 'ros2-topic-info', title: 'ros2 topic info', category: 'ROS 2', summary: '確認 Topic 的 Publisher、Subscriber 數量及端點設定。', syntax: 'ros2 topic info <topic> -v', options: ['-v：顯示端點與 QoS 詳細資訊'], example: 'ros2 topic info /number -v', caution: 'Topic 存在不等於有人發布；echo 本身也會增加訂閱者數量。', related: [], source: 'https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html', aliases: ['publisher count', 'subscriber count'] },
  { id: 'ros2-topic-echo', title: 'ros2 topic echo', category: 'ROS 2', summary: '觀察目前收到的 Topic 訊息。', syntax: 'ros2 topic echo <topic>', options: ['先用 ros2 topic list -t 檢查名稱與型別'], example: 'ros2 topic echo /number', caution: '沒有輸出時先檢查 Publisher count、型別與 QoS；不可直接判定程式壞掉。', related: ['ros2-topic-info'], source: 'https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html' },
  { id: 'docker-ps', title: 'docker ps -a', category: 'Docker', summary: '列出正在執行與已停止的容器，確認容器名稱及狀態。', syntax: 'docker ps -a', options: ['-a：包含已停止的容器'], example: 'docker ps -a', caution: 'docker exec 只能進入正在執行的容器。', related: [], source: 'https://docs.docker.com/reference/cli/docker/container/ls/' },
  { id: 'docker-exec', title: 'docker exec', category: 'Docker', summary: '進入正在執行的容器排查環境。', syntax: 'docker exec -it <container> sh', options: ['-i：保留標準輸入', '-t：分配終端機'], example: 'docker exec -it srecruit-demo sh', caution: '先用 docker ps 確認容器已在執行；映像不一定有 bash。', related: ['docker-ps'], source: 'https://docs.docker.com/reference/cli/docker/container/exec/' },
  { id: 'make-run', title: 'make', category: '編譯', summary: '依專案既有 Makefile 建置；先確認可用 target。', syntax: 'make [target]', options: ['make -n：顯示將執行的命令而不執行'], example: 'make -n', caution: '不要假設每個專案都有 run target；先閱讀 Makefile。', related: [], source: 'https://www.gnu.org/software/make/manual/make.html' },
  { id: 'gcc-version', title: 'gcc --version', category: '編譯', summary: '確認 GCC 是否存在及版本。', syntax: 'gcc --version', options: ['--version：顯示版本'], example: 'gcc --version', caution: '版本資訊不代表專案已成功編譯；仍須使用專案原本的建置指令。', related: ['make-run'], source: 'https://gcc.gnu.org/onlinedocs/gcc/Overall-Options.html' },
]

export type DocLink = { id: string; title: string; category: string; summary: string; url: string; version: string; topics: string[]; checkedAt: string }
export const docs: DocLink[] = [
  { id: 'ros2-topics-doc', title: 'ROS 2 Topics 教學', category: 'ROS 2', summary: '官方 CLI Topic 查詢、發布與訂閱教學。', url: 'https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html', version: 'Jazzy', topics: ['topic info', 'topic echo', 'Publisher'], checkedAt: '尚未於本輪開啟驗證' },
  { id: 'docker-exec-doc', title: 'Docker exec 文件', category: 'Docker', summary: '在執行中的容器執行命令的官方說明。', url: 'https://docs.docker.com/reference/cli/docker/container/exec/', version: '線上文件', topics: ['docker exec', 'container'], checkedAt: '2026-11-13' },
  { id: 'gcc-doc', title: 'GCC 指令選項', category: '編譯', summary: 'GCC 官方選項與版本查詢。', url: 'https://gcc.gnu.org/onlinedocs/gcc/Overall-Options.html', version: '線上文件', topics: ['gcc', '--version'], checkedAt: '2026-11-13' },
  { id: 'make-doc', title: 'GNU Make 手冊', category: '編譯', summary: 'Makefile 與 make target 的官方手冊。', url: 'https://www.gnu.org/software/make/manual/make.html', version: '線上文件', topics: ['make', 'Makefile'], checkedAt: '本輪讀取逾時' },
]

export type Troubleshooting = { id: string; symptom: string; category: string; causes: string[]; diagnostics: string[]; checks: string[]; fixes: string[]; verification: string[]; source: string }
export const troubleshooting: Troubleshooting[] = [
  { id: 'no-channel', symptom: 'No channel／engine_claim() 回傳 -1', category: 'Transfer Engine', causes: ['所有可用 Channel 都被占用；需確認現有工作是否已完成及釋放。'], diagnostics: ['檢查 engine_claim() 的回傳值', '檢查每條完成與錯誤路徑是否呼叫 engine_release()'], checks: ['確認任務允許等待、同步 CPU 備援或回報資源不足哪一種行為。', '確認 Copy／Fill 與 buffer 的語意和容量。'], fixes: ['回傳 -1 時停止 configure/start；等待可用 Channel、在語意相同時安全回退，或回報錯誤。', '工作完成後正確釋放 Channel。'], verification: ['重現四個 Channel 佔用後的第五個 Claim；確認沒有 start(-1)。', '檢查錯誤路徑與正常路徑都不遺漏 release。'], source: 'https://github.com/eason11133/ncku-exam-toolkit/blob/main/src/content/opt-transfer-no-channel-fallback.md' },
  { id: 'ros2-no-messages', symptom: 'ROS 2 Topic 看得到但收不到資料', category: 'ROS 2', causes: ['沒有 Publisher 正在發布。', 'Topic 名稱、型別或 QoS 不相容。'], diagnostics: ['ros2 topic list -t', 'ros2 topic info /number -v', 'ros2 topic echo /number'], checks: ['檢查 Publisher count；echo 本身會增加 Subscriber count。', '確認發送端與接收端的名稱、型別及 QoS。'], fixes: ['依實際不相容的名稱、型別或 QoS 修正端點；沒有 Publisher 時先啟動或排查發送端。'], verification: ['觀察到 Publisher 並在 echo 收到預期訊息。'], source: 'https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Understanding-ROS2-Topics/Understanding-ROS2-Topics.html' },
]
