/**
 * 目标:锁定 stage 工具本身的行为——FIBER_STATES 镜像表与真实状态数值的对应、
 *       traceStates 的过滤、diagnosePending 的扫描。
 * 思路:用一次最小加载/卸载的真实迁移反推数值:首两个迁移必是 PENDING→LOADING、
 *       LOADING→ACTIVE;卸载后 diagnosePending 不再含它。
 * 对照:vendor/cordis/src/fiber.ts 的 FiberState 声明顺序(镜像表的唯一依据)。
 */
import { describe, expect, it } from 'vitest'

import { Context } from '@deepseek-ai/cordis'

import { diagnosePending, stateName, traceStates } from './fiber-trace.ts'

describe('stage/fiber-trace', () => {
  it('stateName:未知数值保留原样,方便发现镜像表失配', () => {
    expect(stateName(0)).toBe('PENDING')
    expect(stateName(99)).toBe('UNKNOWN(99)')
  })

  it('镜像表与真实迁移对齐:PENDING→LOADING→ACTIVE 是任何插件的头两步', async () => {
    const root = new Context()
    const trace = traceStates(root, (name) => name === 'tracer-probe')
    const tracer = {
      name: 'tracer-probe',
      apply() {
        void 0
      },
    }
    await root.plugin(tracer)
    expect(trace.slice(0, 2)).toEqual(['tracer-probe: PENDING -> LOADING', 'tracer-probe: LOADING -> ACTIVE'])
    await root.fiber.dispose()
  })

  it('diagnosePending:只列 PENDING,不列已激活的插件', async () => {
    const root = new Context()
    const sleepy = {
      name: 'sleepy',
      inject: ['no-such-service'],
      apply() {
        void 0
      },
    }
    root.plugin(sleepy)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(diagnosePending(root)).toEqual(['sleepy'])
    await root.fiber.dispose()
    expect(diagnosePending(root)).toEqual([])
  })
})
