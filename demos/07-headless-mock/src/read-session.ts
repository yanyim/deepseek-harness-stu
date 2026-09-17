/**
 * 目标:公共地基——读取 $DSH_HOME 里最近一次 headless 会话的持久化日志,
 *       还原成结构化行供 demo 打印与测试断言。
 * 思路:0.1.6 落盘文件是 session.v3.jsonl.zstd(多帧 zstd:按魔数 28 B5 2F FD
 *       切帧、逐帧解压、拼回 JSONL——教程 read-session.mjs 的原样移植,仅把
 *       文件名从 session.jsonl.zstd 适配成 v3)。会话目录按 cwd-slug 分层,
 *       取「最新 cwd 目录下最新 session 目录」。
 * 对照:教程 demos/05-headless-mock/read-session.mjs(0.1.0-rc.6,文件名无版本号
 *       ——版本差实录);dsh 源码 packages/session 的持久化实现。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

/** 会话日志的一行:seq 序号(首行 session 头没有 seq)+ type 事件类型 + data 载荷。 */
export interface SessionRow {
  seq?: number
  type: string
  data?: unknown
  id?: string
  cwd?: string
  createdAt?: string
}

/** 多帧 zstd → 完整 JSONL 文本(魔数切帧,与教程同一算法)。 */
function decompressFrames(buf: Buffer): string {
  const magic = [0x28, 0xb5, 0x2f, 0xfd]
  const starts: number[] = []
  for (let i = 0; i + 3 < buf.length; i += 1) {
    if (buf[i] === magic[0] && buf[i + 1] === magic[1] && buf[i + 2] === magic[2] && buf[i + 3] === magic[3]) {
      starts.push(i)
    }
  }
  let text = ''
  for (let k = 0; k < starts.length; k += 1) {
    const end = k + 1 < starts.length ? starts[k + 1] : buf.length
    text += zstdDecompressSync(buf.subarray(starts[k], end)).toString()
  }
  return text
}

/** 找到 home 下最近一次会话日志文件并解出全部行;找不到抛错(调用方决定怎么处理)。 */
export function readLatestSession(home: string): { file: string; rows: SessionRow[] } {
  const sessionsRoot = join(home, 'sessions')
  const cwdDir = readdirSync(sessionsRoot).at(-1)
  if (cwdDir === undefined) throw new Error(`${sessionsRoot} 下没有会话目录`)
  const sessionDir = readdirSync(join(sessionsRoot, cwdDir)).at(-1)
  if (sessionDir === undefined) throw new Error(`${cwdDir} 下没有 session 目录`)
  const file = join(sessionsRoot, cwdDir, sessionDir, 'session.v3.jsonl.zstd')
  const rows = decompressFrames(readFileSync(file))
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionRow)
  return { file, rows }
}

/** 把一行日志压成人类可读的一列(demo 打印用;测试用字段级断言,不用这个)。 */
export function summarize(row: SessionRow): string {
  const data = (row.data ?? {}) as Record<string, unknown>
  switch (row.type) {
    case 'session':
      return `# ${row.id ?? ''} cwd=${row.cwd ?? ''}`
    case 'user/message': {
      const content = (data.content ?? []) as { type: string; text?: string }[]
      const text = content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ')
      return `「${text.slice(0, 60)}${text.length > 60 ? '…' : ''}」`
    }
    case 'assistant/message': {
      // 0.1.6 载荷在 data.message.content(不再是 0.1.0-rc.6 的 data.content)
      const message = (data.message ?? {}) as { content?: { type: string; text?: string }[] }
      const text = (message.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ')
      return `「${text.slice(0, 60)}${text.length > 60 ? '…' : ''}」`
    }
    case 'assistant/chunk': {
      const chunk = (data as { chunk?: { type: string; text?: string; index?: number; usage?: unknown; reason?: { kind?: string } } }).chunk
      if (!chunk) return '?'
      if (chunk.type === 'text-delta') return `"${chunk.text}"`
      if (chunk.type === 'usage') return `usage ${JSON.stringify(chunk.usage)}`
      if (chunk.type === 'finish') return `finish ${chunk.reason?.kind}`
      return `${chunk.type} #${chunk.index}`
    }
    case 'turn/end':
      return JSON.stringify((data as { reason?: unknown }).reason)
    case 'request/header':
      return JSON.stringify((data as { header?: { config?: unknown } }).header?.config)
    default:
      return JSON.stringify(row.data).slice(0, 90)
  }
}
