/**
 * 目标:注册机制的解剖标本——一个【不继承 LlmAdapter】的独立类,证明注册表
 *       「不认血缘认行为」:把 LlmAdapter 的全部结构成员手工复刻一遍(含基类
 *       白送的缺省实现),照样注册、照样被 ctx.llm.stream 路由到、照样全链路
 *       跑通。TS 的类型系统本来就是结构化的——结构补齐,连 @ts-expect-error
 *       都不需要;extends 的真实价值是白拿这套缺省实现,不是身份证明。
 * 思路:七个成员对齐 LlmAdapter 的公开面:providerInfo / providerRetryPolicy /
 *       imageRequestPricing / listModels / resolveModel / prepareCall / stream。
 *       prepareCall 手工复刻基类缺省语义:resolveModel 出元数据 + 把 this.stream
 *       绑进去——这正是「extends 之后你只需写 stream」背后发生的事。
 * 对照:dsh 源码 packages/llm/llm 的 registerAdapter/prepareRoutes(注册时立刻
 *       调 providerInfo/providerRetryPolicy 摸行为,无 instanceof)与
 *       adapterStream(dispatch 走 prepareCall→normalizeModelInfo→stream);
 *       qa/03(注册机制问答)。
 */
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'

/** 独立类:与 LlmAdapter 没有任何继承关系,只对齐结构。 */
export class DuckAdapter {
  /** 注册时会被立刻调用:必须回 {id === provider, name 非空}。 */
  providerInfo(provider: string) {
    return { id: provider, name: 'duck' }
  }

  providerRetryPolicy(_provider: string) {
    return undefined
  }

  imageRequestPricing(_provider: string, _model: string) {
    return undefined
  }

  async listModels(_provider: string) {
    return Promise.resolve([])
  }

  /** 基类缺省实现做的事:出一份能过 normalizeModelInfo 的最小模型元数据。 */
  async resolveModel(provider: string, model: string) {
    return { provider, id: model, name: 'duck-1' }
  }

  /** 基类缺省实现做的事:resolveModel + 把 this.stream 绑进 dispatch。 */
  async prepareCall(provider: string, model: string, _signal?: AbortSignal) {
    return {
      model: await this.resolveModel(provider, model),
      stream: (options: GenerateOptions) => this.stream(options),
    }
  }

  async *stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: '嘎!我不是 LlmAdapter 的实例,但我接客。' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: '嘎!' } }
    yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
