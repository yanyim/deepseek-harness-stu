/**
 * 目标:公共地基——手工构造一次「完全装配好的请求」(GenerateOptions)。
 * 思路:0.1.6 的 Message 契约要求三件套:id(跨边界稳定标识)+ content(纯块数组,
 *       不收裸字符串)+ source(生产者溯源),消息创建即冻结。不手搓——直接用官方
 *       createUserMessage 工厂:它生成全新身份并冻结后发布,「不可变创建契约」由
 *       工厂统一执法。运行时对手搓请求不校验(文档原话「hand-built one-shot passes
 *       any list」),契约在类型层与工厂层;那我们就全程走工厂,零 cast 零手搓。
 * 对照:教程 demos/04-llm-mock 第 4 步(0.1.0-rc.6 还只要 {role, content},这是
 *       版本差漂移点之一);guide/04 §4.2/§4.4;dsh 源码 packages/llm/llm types/message
 *       的 createUserMessage。
 */
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'

/** 造一条契约齐全的 user 消息:官方工厂出全新稳定身份,内容是单个 text 块。 */
export function userMessage(text: string): Message {
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  })
}

/** 默认请求:走 mock 路由问一句;字段级覆盖交给调用方。 */
export function buildRequest(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    provider: 'mock',
    model: 'mock-1',
    messages: [userMessage('你好,介绍一下你自己')],
    ...overrides,
  }
}
