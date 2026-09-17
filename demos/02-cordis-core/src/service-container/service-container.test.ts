/**
 * 目标:锁定概念二的行为——proxy 解析、同名互斥、extend 原型继承、isolate 隔离世界、
 *       intercept 只改构造配置不改可见性。
 * 思路:runContainer 剧本整列 toEqual;另加类型断言:声明合并让拼错的服务键
 *       成为编译错误(@ts-expect-error 也是测试的一部分)。
 * 对照:vendor/cordis/src/context.ts 的 extend/isolate/intercept。
 */
import { describe, expect, it } from 'vitest'

import { Context } from '@deepseek-ai/cordis'

import { runContainer } from './container.ts'

describe('概念二:上下文是服务的容器', () => {
  it('proxy 解析 / 互斥 / extend / isolate / intercept 全链路', async () => {
    const lines = await runContainer()
    expect(lines).toEqual([
      '挂载前 ctx.greeter = undefined',
      "挂载后 ctx.greeter.greet('Cordis') = 你好,Cordis!",
      '同名二次注册:service "greeter" has been registered at <GreeterService>',
      'extend 后 child.greeter 仍可用(原型链)= 你好,child!',
      'child.extra = meta,root.extra = undefined',
      'agentA(隔离)看到的 greeter = FAST(agentA)',
      'root 看到的 greeter 仍是原实现 = 你好,root!',
      'agentB(另一个隔离)没注册过 greeter = undefined',
      'intercept(t=0.2) 下构造的 demoLlm.generate = 写代码 @t=0.2',
      '(intercept 只改变构造配置;服务注册后全局可见,root.demoLlm 同一个实例)',
      '无 intercept 的 root 下 demoLlm.generate = 写代码 @t=0.7',
    ])
  })

  it('类型层:服务名拼错是编译错误(声明合并的日常红利)', () => {
    const root = new Context()
    // @ts-expect-error 'greeterr' 没有在 interface Context 声明过——消费侧服务名天然类型化
    void root.greeterr
    expect(Object.isFrozen(root)).toBe(false) // 占位断言:本用例的断言在编译层
  })
})
