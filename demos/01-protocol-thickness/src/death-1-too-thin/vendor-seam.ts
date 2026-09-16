/**
 * 【死法一 · 解法②】厂商特例住独立 seam —— 中立协议零负载
 *
 * 目标:DeepSeek 需要往请求体注顶层字段(log_id 等),但 GenerateOptions 一个字段都不许加
 *       —— 同样的需求,anti-pattern.ts 给出了错误答案,本文件给出正确答案。
 * 思路:三角色各归其位,互不 import,只通过 seam 协作(运行时注册,而非代码依赖):
 *         seam 本体    —— VendorApiExtensions(本文件):按「字段」注册、wire 层合并
 *         提供方       —— loadLogTagging:只负责自己名下的 log_id(对应 session-log-deepseek)
 *         消费方       —— DeepseekMockAdapter:唯一知道 seam 存在的适配器(对应 llm-deepseek)
 *       于是:扩展插件卸载 = wire 上字段消失;厂商适配器换掉 = 整个 seam 无人消费,自然不存在。
 * 对照:packages/llm/deepseek-llm-api-extensions(注意:中立协议 GenerateOptions 全程形状不变)。
 */

import type { Context } from '../stage/kernel.ts'
import { BaseAdapter } from '../stage/llm-seam.ts'
import type { GenerateOptions, StreamChunk } from '../stage/llm-seam.ts'

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

/** 扩展插件可见的请求事实(只读,不含中立协议的原始消息) */
export interface VendorExtensionRequest {
  readonly provider: string
  readonly model: string
}

type Prepare = (request: VendorExtensionRequest) => Record<string, JsonValue>

/** seam 本体:Service Definition */
export class VendorApiExtensions {
  static readonly key = 'vendorApiExtensions'
  readonly ctx: Context
  #providers = new Map<string, Prepare>()

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  /** 一个扩展插件负责自己名下的顶层字段(dsh:各插件准备彼此独立的顶层字段) */
  register(field: string, prepare: Prepare): void {
    if (this.#providers.has(field)) throw new Error(`扩展字段冲突:${field}`)
    this.#providers.set(field, prepare)
    this.ctx.effect(() => this.#providers.delete(field))
  }

  /** 厂商适配器在自家 wire 层合并全部字段;中立协议对此一无所知 */
  prepareFields(request: VendorExtensionRequest): Record<string, JsonValue> {
    const merged: Record<string, JsonValue> = {}
    for (const prepare of this.#providers.values()) {
      Object.assign(merged, prepare(request))
    }
    return merged
  }
}

/** 提供方:往 DeepSeek wire 上放一个 log_id 字段 */
export function loadLogTagging(ctx: Context): void {
  ctx.use<VendorApiExtensions>(VendorApiExtensions.key).register('log_id', (request) => ({
    log_id: `sess-${request.provider}-${request.model}`,
  }))
}

/** 消费方:示意 llm-deepseek —— 只有它在 wire 层关心厂商扩展 */
export class DeepseekMockAdapter extends BaseAdapter {
  #ctx: Context
  lastWire: Record<string, JsonValue> | undefined

  constructor(ctx: Context) {
    super()
    this.#ctx = ctx
  }

  override async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const extensions = this.#ctx.use<VendorApiExtensions>(VendorApiExtensions.key)
    this.lastWire = {
      model: options.model,
      ...extensions.prepareFields({ provider: options.provider, model: options.model }),
    }
    yield { type: 'text-delta', text: `deepseek wire: ${JSON.stringify(this.lastWire)}` }
    yield { type: 'finish', reason: 'stop' }
  }
}
