/**
 * 目标:qa/03 追问的实测标本——「不继承 LlmAdapter,改继承 DeepSeekAdapter 并
 *       override stream」行不行?答案:能编译、能注册,但 override 在 runtime
 *       路径上是【死代码】。
 * 思路:子类化公开导出的 DeepSeekAdapter,override stream 吐标记 chunk;对比两条
 *       路:经 ctx.llm.stream(runtime 必走 prepareCall)vs 直调 sub.stream()。
 *       0.1.6 的 DeepSeekAdapter 是门面:providerInfo/prepareCall 都先
 *       this.implementation() 按 protocol 分派到内部实现,dispatch 闭包绑的是
 *       implementation 的私有传输路径,不经过 this.stream——基类「stream 是唯一
 *       必须实现的方法」的扩展点承诺,被具体子类的 prepareCall override 越过了。
 *       另外:构造要喂齐 17 个连接字段 + 4 个解析器(protocol 填错在【注册层】
 *       providerInfo 摸底时 assertNever 当场炸)——继承具体适配器 = 背它的构造义务。
 * 对照:dsh-llm-deepseek lib/index.js L1209(DeepSeek prepareCall 绑
 *       streamWithConnection)、L2847(门面按 implementation 分派)、L2678(pi-ai
 *       适配器同款姿势 generate);qa/03 追问节;拦截的正解见本 demo 单元三
 *       (llm/stream 瀑布短路,连适配器都不用注册)与 demos/07(自有路由+改配置)。
 */
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { DeepSeekAdapter } from '@deepseek-ai/dsh-llm-deepseek'
import type { DeepSeekAdapterOptions } from '@deepseek-ai/dsh-llm-deepseek'

/** override 是否被调用的在场证明:runtime 路径的输出里找不到它 = override 没跑。 */
export const OVERRIDE_MARKER = 'override 在场证明'

/** 连接事实:全部字段喂齐(这就是「继承具体适配器的入场费」);端点指向不可达端口,
 * 若 dispatch 走了真传输层,连接必失败 → runtime 包成 finish error。 */
const probeConnection = () => ({
  protocol: 'chat-completions',
  baseURL: 'http://127.0.0.1:9/',
  apiKeyEnv: 'env:PROBE',
  defaults: {},
  maxTokens: 64,
  defaultContextWindow: 4096,
  models: [],
  streamIdleTimeoutMs: 1000,
  maxRequestFilesBytes: 0,
  maxInlineRequestImageBytes: 0,
  maxImagesPerRequest: 0,
  imageOffloadByteQuantum: 1,
  inlineImageOffloadByteQuantum: 1,
  imageOffloadCountQuantum: 1,
  filesApiTimeoutMs: 1000,
  filePolicy: {},
  retryPolicy: resolveRetryPolicy(undefined, 'probe'),
})

/** 子类:override stream 吐标记 chunk——编译通过、方法本身可用。 */
export class SubclassedDeepSeekAdapter extends DeepSeekAdapter {
  constructor() {
    // 一处打包断言:品牌字段(CredentialRef/AnonymousUserId 等)不是本探针的重点
    super({
      options: probeConnection,
      resolveApiKey: async () => 'sk-probe',
      resolveUserId: () => 'anon',
      prepareExtensions: async () => ({}),
    } as unknown as DeepSeekAdapterOptions)
  }

  override stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    return (async function* () {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: OVERRIDE_MARKER }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: OVERRIDE_MARKER } }
      yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })()
  }
}
