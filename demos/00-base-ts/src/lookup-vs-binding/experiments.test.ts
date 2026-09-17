/**
 * 目标:锁定单元一行为——查找三层优先级、晚绑定引用命中子类 override、
 *       父类代码里 this === 子类实例(同一性)、super 不换 this。
 * 思路:runLookupExperiments 整列 toEqual(剧本锁定)+ 关键行为补充断言
 *       (遮蔽可删、同一性恒真——与 qa/03 WitnessOfThis 同一招)。
 * 对照:./experiments.ts;demos/06 registry/facade-pattern.test.ts 的追问三校对。
 */
import { describe, expect, it } from 'vitest'

import { runLookupExperiments } from './experiments.ts'

describe('单元一:查找决定代码,this 绑定决定身份', () => {
  it('六幕剧本整列锁定', () => {
    expect(runLookupExperiments()).toEqual([
      '① new Grand().who() → Grand.code(this.tag=grand)',
      '② new Mid().who()   → Mid.code(this.tag=mid)',
      '③ 实例遮蔽 who      → instance-shadow',
      '   delete 后回落     → Mid.code(this.tag=mid)',
      '④ m.hello()         → hello → Mid.code(this.tag=mid)',
      '⑤ 父类代码里的 this === 子实例 → true',
      '⑥ super 链          → MidChild(super Mid.code(this.tag=mid-child))',
    ])
  })
})
