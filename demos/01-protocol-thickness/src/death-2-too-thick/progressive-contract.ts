/**
 * 【死法二 · 解法⑤】渐进式契约:厚变成可选菜单,而不是入门门槛
 *
 * 目标:协议可以有 1092 行的厚度,但最小实现者的成本必须只有一个方法 ——
 *       「厚」不再吓退 Provider,也就没人有动力为省事把协议抄薄一份(分叉的开端)。
 * 思路:BaseAdapter(stage/llm-seam.ts)唯一必实现的是 stream(),
 *       其余能力(listModels / resolveModel / …)全部给默认实现,按需覆盖。
 *       本文件用一个内联最小适配器 + 断言函数给出「证据」。
 * 对照:packages/llm/llm/src/index.ts:193 —— dsh 的 LlmAdapter 同款设计
 *       (1092 行协议,1 个抽象方法);MockAdapter(stage/)是同一个证明的舞台版。
 */

import { BaseAdapter } from '../stage/llm-seam.ts'
import type { GenerateOptions, LlmModelInfo, StreamChunk } from '../stage/llm-seam.ts'

/** 证据 A:整个适配器只有一个方法有身体 —— 其余契约全部吃默认值 */
export class MinimalAdapter extends BaseAdapter {
  override async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    yield { type: 'text-delta', text: `ok:${options.model}` }
    yield { type: 'finish', reason: 'stop' }
  }
}

/** 证据 B:显式演示默认值长什么样 —— 可选能力缺席不是错误 */
export function demonstrateDefaults(adapter: MinimalAdapter): void {
  const models: LlmModelInfo[] = adapter.listModels()
  const resolved = adapter.resolveModel('mock', 'deepseek-chat')
  console.log(`  listModels()  默认 = ${JSON.stringify(models)} ← 「不知道」,消费方不得当错误`)
  console.log(`  resolveModel() 默认 = ${JSON.stringify(resolved)} ← 原样返回`)
}
