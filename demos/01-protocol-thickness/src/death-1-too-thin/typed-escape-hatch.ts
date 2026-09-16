/**
 * 【死法一 · 解法①】有类型的逃生口:闭结构、开词汇(merge-extensible map)
 *
 * 目标:协议要能长新词汇,但既不改核心包、也不开无类型的洞(对比 anti-pattern.ts)。
 * 思路:词汇表结构封闭(按 type 判别 + 消费方必须兜底未知),条目开放(declare module 声明合并)。
 *       两半缺一不可:
 *         类型半 —— 本文件的 declare module,让编译器认识 'math'(有类型的逃生口)
 *         运行时半 —— 向渲染 seam 注册渲染器(effect,插件卸载即撤销),处理义务跟着插件走
 * 对照:packages/llm/llm 的 ContentBlockMap / FinishReasonMap / SessionEventMap……
 *       全仓 25+ 个文件在做这种跨包声明合并 —— 是日常操作,不是理论机制。
 */

import type { Context } from '../stage/kernel.ts'
import type { ContentBlockMap } from '../stage/llm-seam.ts'
import { RenderRuntime } from '../stage/render.ts'

export interface MathBlock {
  type: 'math'
  latex: string
}

declare module '../stage/llm-seam.ts' {
  interface ContentBlockMap {
    'math': MathBlock
  }
}

/** 第三方插件入口:谁 import 本文件,谁的编译单元词汇表就多了 'math' */
export function loadMathBlocks(ctx: Context): void {
  ctx.use<RenderRuntime>(RenderRuntime.key).register(
    'math',
    (block: MathBlock) => `$${block.latex}$`,
  )
}
