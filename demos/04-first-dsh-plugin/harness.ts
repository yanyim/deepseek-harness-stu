/**
 * 目标:裸 dsh 底座——demo/测试/编程式场景共用的入口:裸 Cordis 挂上 dsh 能力插件,
 *       组合来自 cordis.yml(或编程式传入)。不启动 dsh 主 CLI,无需 API key。
 * 思路:与 `@deepseek-ai/cordis` 的 bin.js 语义一致:new Context → 设置 baseUrl → 挂
 *       Loader → include 插件加载组合文件。差异仅是"配置文件路径"从约定变成参数。
 * 对照:官方文档 cordis-tutorial/07-into-the-harness「组合并运行」;
 *       `@deepseek-ai/cordis` bin.js。dsh 包统一 pin 0.1.6-alpha.1(见 package.json——
 *       0.0.1-rc.1 的依赖树引用未发布的 dsh-type-meta,装不上,勘误记录在 README)。
 *       tsc allowImportingTsExtensions 下 npm 包名无扩展名,禁用 ts 文件名 lint 假阳性。
 */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { pathToFileURL } from 'node:url'

export interface HarnessOptions {
  /** 组合文件路径(yaml);缺省等价于 cordis.yml。 */
  readonly configPath?: string
  /** 组合的 cwd——插件相对路径解析的基准。 */
  readonly cwd?: string
}

export async function startHarness(
  options: HarnessOptions = {},
  configure: (ctx: Context) => void = () => undefined,
): Promise<Context> {
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(options.cwd ?? process.cwd()).href + '/'
  configure(ctx)
  await ctx.plugin(Loader)
  await ctx.loader.create({
    name: '@deepseek-ai/cordis-plugin-include',
    config: { path: options.configPath ?? './cordis.yml' },
  })
  return ctx
}

export { Context }
