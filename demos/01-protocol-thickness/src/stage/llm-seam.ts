/**
 * 【舞台】实验对象:LLM 协议本体 —— 后面所有解法都要指着它说「看,这里没被污染」
 *
 * 目标:定义一份中立协议(词汇表 + 请求形状 + 调用面),它是全部论证的参照系:
 *       死法一在这里加透传字段(anti-pattern),解法①②证明它可以保持零厂商负载,
 *       解法⑤(渐进式契约)体现在 BaseAdapter,解法⑥(waterfall)体现在 LlmRuntime.stream。
 * 思路:三角色一体的 seam —— 本文件是 Service Definition,适配器是 Provider,调用方是 Consumer。
 * 对照:packages/llm/llm(ContentBlockMap、GenerateOptions、LlmAdapter、LlmRuntime)。
 */

import type { Context } from './kernel.ts'

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ReasoningBlock {
  type: 'reasoning'
  text: string
}

export interface ToolCallBlock {
  type: 'tool-call'
  name: string
  arguments: string
}

/**
 * 词汇表:核心只定义三种,插件可以 declare module 添加新条目
 * (见 death-1-too-thin/typed-escape-hatch.ts —— dsh 的注释原话:"New core
 * blocks must land with adapter, UI, and compaction support",新词汇必须自带完整处理义务)。
 */
export interface ContentBlockMap {
  'text': TextBlock
  'reasoning': ReasoningBlock
  'tool-call': ToolCallBlock
}

/** 任何已知内容块,由词汇表派生;switch on type,未知词汇走兜底 */
export type ContentBlock = ContentBlockMap[keyof ContentBlockMap]

export interface Message {
  role: 'user' | 'assistant'
  content: ContentBlock[]
}

/** 中立请求:结构封闭(字段固定),厂商差异一律不进这里 —— 解法②的论证对象 */
export interface GenerateOptions {
  provider: string
  model: string
  system?: string
  messages: Message[]
}

export interface LlmModelInfo {
  provider: string
  id: string
  name: string
}

export type StreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'finish'; reason: 'stop' | 'tool-calls' | 'aborted'; failure?: string }

/**
 * 渐进式契约的载体:dsh 的 LlmAdapter 用 abstract class 表达
 * (packages/llm/llm/src/index.ts:193,1092 行协议只有 1 个抽象方法 stream)。
 * 这里用「缺省抛错」表达同一件事,以兼容 Node 原生 TS 直跑。
 * 证明见 death-2-too-thick/progressive-contract.ts。
 */
export class BaseAdapter {
  /** 可选能力:模型目录。默认「不知道」,消费方不得把缺席当错误 */
  listModels(): LlmModelInfo[] {
    return []
  }

  /** 可选能力:精确路由元数据。默认原样返回 */
  resolveModel(provider: string, model: string): LlmModelInfo {
    return { provider, id: model, name: model }
  }

  /** 唯一必须实现的方法 */
  stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    throw new Error('适配器必须实现 stream()')
  }
}

/**
 * Service Definition:适配器注册表 + 调用面。
 * 消费方入口先过 waterfall('llm/stream') 再落适配器 ——
 * 「拦截走事件不走参数」的铰链在这里,姿态见 death-2-too-thick/interception-by-event.ts。
 */
export class LlmRuntime {
  static readonly key = 'llm'
  readonly ctx: Context
  #adapters = new Map<string, BaseAdapter>()

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  registerAdapter(provider: string, adapter: BaseAdapter): void {
    if (this.#adapters.has(provider)) throw new Error(`provider 路由冲突:${provider}`)
    this.#adapters.set(provider, adapter)
    this.ctx.effect(() => this.#adapters.delete(provider))
  }

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const adapter = this.#adapters.get(options.provider)
    if (!adapter) throw new Error(`未注册的 provider:${options.provider}`)
    const finalOptions = await this.ctx.waterfall('llm/stream', options)
    yield* adapter.stream(finalOptions)
  }
}
