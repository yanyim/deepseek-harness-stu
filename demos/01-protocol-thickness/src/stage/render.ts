/**
 * 【舞台】渲染 seam —— 词汇表的「运行时半」,供解法①使用
 *
 * 目标:让「新增一种内容块」在运行时也有落点,而不是只有类型层的认识。
 * 思路:每种 block 的渲染器是一个 effect,由插件注册、卸载即撤销;
 *       未知词汇必须兜底(fall through unknown)—— 闭结构契约的消费方一半。
 * 对照:dsh 中「新核心块必须同时落地 adapter、UI、compaction 支持」的义务链。
 */

import type { ContentBlock } from './llm-seam.ts'
import type { Context } from './kernel.ts'

export class RenderRuntime {
  static readonly key = 'render'
  readonly ctx: Context
  #renderers = new Map<string, (block: any) => string>()

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  register<T>(type: string, render: (block: T) => string): void {
    this.#renderers.set(type, render as (block: any) => string)
    this.ctx.effect(() => this.#renderers.delete(type))
  }

  render(block: ContentBlock): string {
    const renderer = this.#renderers.get(block.type)
    if (renderer) return renderer(block)
    // 闭结构契约:词汇表是开放的,所以未知必须兜底而不是崩溃
    return `〔未渲染的块:${block.type}〕`
  }
}
