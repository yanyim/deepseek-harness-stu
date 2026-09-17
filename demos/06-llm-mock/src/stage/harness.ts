/**
 * 目标:公共地基——把 LlmRuntime 挂上裸 Context,并提供 chunk 收集器。
 * 思路:new Context() → await ctx.plugin(LlmRuntime)。LlmRuntime 是类插件,
 *       构造器里把自己注册为 ctx.llm 服务——「模型提供方也是一个插件」的第一块
 *       证据:挂载这个动作本身就是一次插件加载。collectChunks 把 async iterable
 *       一次收完,main 与各测试共用,断言面向整条序列而非边收边看。
 * 对照:dsh 源码 packages/llm/llm(LlmRuntime 定义);教程 demos/04-llm-mock 第 2 步;
 *       本仓库 demos/04 的 harness-inline.ts(同一姿势挂 dsh-tools/system-prompt)。
 */
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'

/** 挂一个只有 Llm 服务的裸上下文:ctx.llm 从此可用,别无他物。 */
export async function mountLlm(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  return ctx
}

/** 把一条 chunk 流收到数组为止——测试与 main 都要「看整条序列再说话」。 */
export async function collectChunks(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}
