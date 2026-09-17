/**
 * 目标:单元一「Mock 适配器本体」——一个把输入直接加工后回复的假模型。回什么、
 *       按什么顺序吐 chunk,全部由 guide/04 §4.3 的五条协议义务推出,一条不多。
 * 思路:取最后一条 user 消息文本 + 请求元数据,加工出「思考」(reasoning)与「回答」
 *       (text)两段输出,两块交织着吐——义务②(index 按首次出现分配,交织增量靠
 *       index 归位)存在的理由,单块版本根本演示不出来。usage 也从输入派生而非魔法
 *       数(输入 token = 全部消息文本长度,输出 token = 两段输出长度)。取消在下一
 *       个 delta 边界生效,转成 finish {kind:'aborted'}(义务③④);usage 一定先于
 *       finish,之后不发任何东西(义务①)。
 * 对照:教程 demos/04-llm-mock 的 MockAdapter(单块版,usage 是魔法数 42/13);
 *       dsh 源码 packages/llm/llm 的 LlmAdapter(stream 是唯一必须实现的方法);
 *       guide/04 §4.3–§4.4。刻意不做:tool-call-delta 流(教程 Demo 6 的料)、
 *       replayState(可回放体系)、真实 SSE 翻译。
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, Message, StreamChunk } from '@deepseek-ai/dsh-llm'

const PIECE = 3 // 每片字符数:模拟逐字流式的最小颗粒

export interface EchoAdapterOptions {
  /** 相邻 delta 之间的延迟毫秒:main 用小延迟肉眼看「流」,测试用 0 走纯逻辑。 */
  deltaDelayMs?: number
}

export class EchoAdapter extends LlmAdapter {
  readonly deltaDelayMs: number

  constructor(options: EchoAdapterOptions = {}) {
    super()
    this.deltaDelayMs = options.deltaDelayMs ?? 0
  }

  /** LlmAdapter 唯一必须实现的方法:把一次请求流式化为 chunk。 */
  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const lastUser = [...options.messages].reverse().find((m) => m.role === 'user')
    const heard = lastUser ? textOf(lastUser.content) : '(没有 user 消息)'
    const thinking = `收到 ${options.messages.length} 条消息,最后一条 user 说:「${heard}」;`
      + `带 ${options.tools?.length ?? 0} 个工具。`
    const answer = `我是 EchoAdapter。你刚才说:"${heard}"。`
      + `(provider=${options.provider}, model=${options.model}, 工具数=${options.tools?.length ?? 0})`
    const inputTokens = options.messages.reduce((n, m) => n + textOf(m.content).length, 0)

    try {
      // 义务②:两个块按首次出现分配 index 0/1
      yield { type: 'block-start', index: 0, blockType: 'reasoning' }
      yield { type: 'block-start', index: 1, blockType: 'text' }
      const thinkPieces = pieces(thinking)
      const answerPieces = pieces(answer)
      const count = Math.max(thinkPieces.length, answerPieces.length)
      for (let i = 0; i < count; i += 1) {
        // 交织吐两块的增量:消费方只能靠 index 归位
        if (thinkPieces[i] !== undefined) {
          await this.tick()
          options.signal?.throwIfAborted() // 义务④:取消在下一个 delta 边界生效
          yield { type: 'reasoning-delta', index: 0, text: thinkPieces[i] }
        }
        if (answerPieces[i] !== undefined) {
          await this.tick()
          options.signal?.throwIfAborted()
          yield { type: 'text-delta', index: 1, text: answerPieces[i] }
        }
      }
      yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: thinking } }
      yield { type: 'block-end', index: 1, block: { type: 'text', text: answer } }
      // 义务①:usage 先于 finish,finish 之后不再发任何东西
      yield { type: 'usage', usage: { inputTokens, outputTokens: thinking.length + answer.length } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } catch (err) {
      if (options.signal?.aborted) {
        // 义务③:取消是带内失败,消费方拿到的是合法终止而非裸异常
        yield { type: 'finish', reason: { kind: 'aborted', failure: { message: 'aborted', code: 'ABORTED' } } }
        return
      }
      throw err
    }
  }

  private async tick(): Promise<void> {
    if (this.deltaDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.deltaDelayMs))
  }
}

function pieces(text: string): string[] {
  return text.match(new RegExp(`[\\s\\S]{1,${PIECE}}`, 'g')) ?? []
}

function textOf(content: Message['content']): string {
  return content
    .filter((b): b is Extract<Message['content'][number], { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
}
