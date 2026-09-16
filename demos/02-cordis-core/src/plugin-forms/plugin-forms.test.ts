/**
 * 目标:锁定概念一的行为——三形态等价、Config 校验失败时 await fiber 抛
 *       ValidationError 且 fiber 终态 FAILED(进程不死)。
 * 思路:runForms 的剧本行整列 toEqual(叙事顺序 = 行为顺序);FAILED 是从
 *       真实状态机读出来的,不是写死的字符串。
 * 对照:vendor/cordis/src/fiber.ts 的 resolveConfig + _reload catch 分支。
 */
import { describe, expect, it } from 'vitest'

import { runForms } from './forms.ts'

describe('概念一:插件是实现服务的对象', () => {
  it('三形态依次挂载全部执行;坏配置 await 抛错、终态 FAILED', async () => {
    const lines = await runForms()
    expect(lines).toEqual([
      '[形态一·函数] tick hello',
      '[形态二·对象] apply 运行',
      '[形态三·类] 构造即 apply,count=1',
      '[Config] 校验通过,apply 收到 = {"prefix":"hello"}',
      '[Config] await fiber 抛错:ValidationError',
      '[Config] 坏配置的 fiber 终态:FAILED(状态可见,进程仍活着)',
    ])
  })
})
