/**
 * 目标:fiber 状态数值 → 名字的镜像表(demo 03 内部使用)。
 * 思路:发布构建擦除了 `export const enum FiberState`(详见 demo 02 的 stage/fiber-trace.ts
 *       及其测试——那里的用例锁定本表与真实迁移的对应关系,此处不重复锁定)。
 * 对照:vendor/cordis/src/fiber.ts 的 FiberState 声明顺序。
 */
export const FIBER_STATES = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING'] as const

export function stateName(state: number): string {
  return FIBER_STATES[state] ?? `UNKNOWN(${state})`
}
