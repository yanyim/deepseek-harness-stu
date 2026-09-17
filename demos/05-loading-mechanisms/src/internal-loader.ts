/**
 * 目标:开盒 Node 内部 ESM 加载器(cascaded loader)——拿到它的本体,才能演示
 *       「指定身份(parentURL)的 import」这一档。
 * 思路:复刻 @deepseek-ai/cordis-plugin-loader 的 ModuleLoader.fromInternal 两扇门——
 *       门一:进程以 --expose-internals 启动时,require 内部模块;
 *       门二:原生插件 node-addon-require-builtin(本仓库未装,注释说明)。
 *       两扇都开不了返回 undefined——与 loader 插件一致:防御性降级,不硬猜;
 *       到手后做能力检测(import + resolveSync 都在才认),不按版本猜形状。
 * 对照:@deepseek-ai/cordis-plugin-loader@1.0.3 lib/index.js:8-44
 *       (requireInternal / fromInternal / v1-v2 能力检测);qa/02 附录四 §1.5。
 */
import { createRequire } from 'node:module'

/** Node 内部加载器的形状(只声明本 demo 用到的两个方法;Node 22.19 实测 v1 形状)。 */
export interface InternalLoader {
  /** 以 parentURL 为解析起点动态 import——身份在这里是指定参数。 */
  import(specifier: string, parentURL: string, options: Record<string, never>): Promise<unknown>
  /** 以 parentURL 为解析起点解析 specifier → 绝对 URL。 */
  resolveSync(specifier: string, parentURL: string): { url: string }
}

/**
 * 两扇门都尝试后拿到的内部加载器;拿不到 = undefined(调用方应走兜底档)。
 * 与 loader 插件同款语义:不抛错、不猜,静默降级。
 */
export function fromInternal(): InternalLoader | undefined {
  if (!process.execArgv.includes('--expose-internals')) return undefined // 门一没开
  const require = createRequire(import.meta.url)
  let raw: unknown
  try {
    raw = (require('internal/modules/esm/loader') as { getOrInitializeCascadedLoader?: () => unknown })
      ?.getOrInitializeCascadedLoader?.()
  } catch {
    raw = undefined // 门一开了但 require 失败(内部形状变化)——不猜
  }
  // 门二:node-addon-require-builtin(原生插件从 C++ 层 require 内建模块;本仓库未装,
  // 装了即可用,姿势与 loader 插件相同)
  if (raw === undefined) return undefined
  const loader = raw as Partial<InternalLoader>
  // 能力检测:import 与 resolveSync 都在才算认识(v1 实测暴露这两个;v2 同样)
  if (typeof loader.import !== 'function' || typeof loader.resolveSync !== 'function') return undefined
  return loader as InternalLoader
}
