/**
 * 目标:让 fiber 状态机的迁移可观察——本 demo 多个单元都要"看见"PENDING/级联卸载。
 * 思路:Cordis 在每次 fiber 状态迁移时派发 `internal/status`(fiber, 旧状态)事件,
 *       订阅它把 `name: OLD -> NEW` 记进一个字符串数组,与各单元的剧本行同构。
 * 对照:vendor/cordis/src/fiber.ts 的 `_updateState`(迁移发源地);
 *       官方文档 cordis-tutorial/06 的 diagnose.ts 用 FiberState 做同类诊断。
 *
 * 教学点:发布构建把 `export const enum FiberState` 擦除了(const enum 编译期内联),
 * npm 版运行时拿不到这个名字表——官方教程能 `import { FiberState }` 是因为它用
 * tsx 直跑 vendor 源码,esbuild 会把 const enum 转成对象。我们用 npm 版,所以按
 * vendor/cordis/src/fiber.ts 的声明顺序镜像数值(见 stage.test.ts 的行为锁定)。
 */
import type { Context } from '@deepseek-ai/cordis'

/** 镜像 vendor/cordis const enum FiberState 的数值顺序。 */
export const FIBER_STATES = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING'] as const

export type FiberStateName = (typeof FIBER_STATES)[number]

/** 数值 → 状态名;对不上号时保留原值,方便发现镜像表失配。 */
export function stateName(state: number): string {
  return FIBER_STATES[state] ?? `UNKNOWN(${state})`
}

/**
 * 订阅 internal/status,记录状态轨迹。
 * @param filter 只保留指定插件名的迁移(默认全部保留;root 自身的迁移也会进来)
 * @returns 轨迹行数组(调用方持续读;订阅随 root 卸载自动撤销)
 */
export function traceStates(root: Context, filter?: (name: string) => boolean): string[] {
  const lines: string[] = []
  root.on('internal/status', (fiber, old) => {
    if (filter && !filter(fiber.name)) return
    lines.push(`${fiber.name}: ${stateName(old)} -> ${stateName(fiber.state)}`)
  })
  return lines
}

/**
 * 扫描注册表,列出所有 PENDING 的插件——"插件没反应"时的第一诊断手段。
 * 对照:官方文档 cordis-tutorial/06 的 diagnose.ts。
 */
export function diagnosePending(root: Context): string[] {
  const pending: string[] = []
  for (const runtime of root.registry.values()) {
    for (const fiber of runtime.fibers) {
      if (stateName(fiber.state) === 'PENDING') pending.push(fiber.name)
    }
  }
  return pending
}
