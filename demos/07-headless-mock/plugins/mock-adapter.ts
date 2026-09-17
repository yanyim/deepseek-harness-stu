/**
 * 目标:插件形态的 Mock 适配器——供给真实 dsh 进程(--profile headless --patch)
 *       加载,把「模型提供方」整个换成假模型:不发一个网络请求跑通 Agent 全链路。
 * 思路:与 demos/06 的 EchoAdapter 同一协议义务,但这里是「插件文件」形态:
 *       name/inject/apply 三段,注册写在 apply 里(effect:插件卸载自动撤销)。
 *       回复取第一条 user 消息(= 真正的任务);模型实际看到的消息比任务多
 *       (skills 提醒等注入上下文也以 user-role 排在后面),find 换 findLast
 *       就能亲眼看到注入内容(教程实验 2)。
 * 对照:教程 demos/05-headless-mock/plugins/mock-adapter.ts(0.1.0-rc.6 版,
 *       附带 echo 工具分支——那是教程 Demo 6 的料,本 demo 刻意省去);
 *       本仓库 demos/06-llm-mock(适配器协议义务的逐条锁定)。
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import type { ContentBlock, GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'

export const name = 'mock-adapter'
export const inject = ['llm'] as string[]

function textOf(content: ContentBlock[]): string {
  return content
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
}

/** 取第一条 user 消息:注入的上下文(skills 等)以 user-role 排在任务之后。 */
function taskText(messages: GenerateOptions['messages']): string {
  const user = messages.find((m) => m.role === 'user')
  return user ? textOf(user.content) : ''
}

class MockAdapter extends LlmAdapter {
  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const text = `（MockAdapter，无需网络与 API Key）收到你的消息："${taskText(options.messages)}"。` +
      `当前 provider=${options.provider}，model=${options.model}。`

    try {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      for (const piece of text.match(/[\s\S]{1,3}/g) ?? []) {
        options.signal?.throwIfAborted() // 义务④:遵守取消
        yield { type: 'text-delta', index: 0, text: piece }
      }
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }
      yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 20 } } // 义务①:先于 finish
      yield { type: 'finish', reason: { kind: 'stop' } }
    } catch (err) {
      if (options.signal?.aborted) {
        yield { type: 'finish', reason: { kind: 'aborted', failure: { message: 'aborted', code: 'ABORTED' } } }
        return
      }
      throw err
    }
  }
}

export function apply(ctx: Context) {
  // 注册是 effect:插件卸载时自动撤销,HMR 安全
  ctx.llm.registerAdapter(['mock'], new MockAdapter())
}
