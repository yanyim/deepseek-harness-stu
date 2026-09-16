/**
 * 【舞台】跑通链路的最小适配器 —— 顺带预演解法⑤(渐进式契约)
 *
 * 目标:给舞台一个能出声的 Provider,让后续论证可以在真实调用流上做。
 * 思路:只实现 stream(),其余契约(listModels / resolveModel)全部吃默认值。
 * 对照:dsh 的 test-support/llm-replay(mock 适配器无需 API Key 即可跑通链路)。
 */

import { BaseAdapter } from './llm-seam.ts'
import type { GenerateOptions, StreamChunk } from './llm-seam.ts'

export class MockAdapter extends BaseAdapter {
  override async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    yield {
      type: 'text-delta',
      text: `(mock:${options.model}) 收到 ${options.messages.length} 条消息`,
    }
    yield { type: 'finish', reason: 'stop' }
  }
}
