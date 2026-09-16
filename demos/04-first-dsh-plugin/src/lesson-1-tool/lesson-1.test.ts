/**
 * 目标:锁定第一课的行为——工具注册+执行+观察者命中,全走裸 dsh 真服务。
 * 思路:走 harness-inline 编程式组合(vitest 的 node loader 不认 cwd 下的裸 .ts
 *       文件,loader 的文件路径走不通;能力包本身是正常 ESM import);greet-tool 与
 *       observer 模块与 demo 同一份代码,demo 从 yaml 加载、测试从这里 import——
 *       两种组合殊途同归,这本身就是 yaml 形态的教学点。
 * 对照:cordis.yml(同一组合的文件形态);官方 cordis-tutorial/07;guide/06。
 */
import { describe, expect, it } from 'vitest'

import { startInlineHarness } from '../../harness-inline.ts'
import { observations } from './tool-observer.ts'
import * as greetTool from './greet-tool.ts'
import * as toolObserver from './tool-observer.ts'

describe('第一课:向真实 dsh 工具流水线注册+执行+观察', () => {
  it('greet 工具经 tools.execute 流过完整管线,观察者按 tools/result 记账', async () => {
    observations.length = 0
    const ctx = startInlineHarness([toolObserver, greetTool])
    // greet-tool 在 apply 末尾 void(async) 发起 execute;轮询等观察者落账
    for (let i = 0; i < 50 && observations.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    expect(observations).toEqual(['greet -> Hello, Cordis!'])

    await ctx.fiber.dispose()
  })
})
