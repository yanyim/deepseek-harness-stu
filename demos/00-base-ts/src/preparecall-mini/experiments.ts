/**
 * 目标:幕三串场——把六个姿势缝成一份剧本(每姿势一行的对照矩阵),
 *       main 打印、测试整列锁定共用。
 * 思路:调用形态都是 stream("hi") / prepare().stream("hi");差别只在两件事:
 *       prepare 方法体里 this 的去向,以及你走哪条路(分派链 or 直调)。
 * 对照:./base-style.ts ./facade-style.ts ./detached-style.ts ./self-facade.ts
 *       (各姿势标本,含各自的三段注释);demos/06 真实链路版探针 C/D;qa/03。
 */
import { BaseSub } from './base-style.ts'
import { DetachedStyle } from './detached-style.ts'
import { FacadeStyle, FacadeSub, wireObserver } from './facade-style.ts'
import { SelfFacadeStyle } from './self-facade.ts'

export function runPrepareCallExperiments(): string[] {
  const out: string[] = []

  out.push(`① 基类姿势(用缺省 prepare):prepare().stream("hi") → ${new BaseSub().prepare().stream('hi')}`)
  out.push(`   (闭包写 this.stream → 子类 stream 生效)`)
  out.push(`② 门面姿势(prepare 改写为转移):prepare().stream("hi") → ${new FacadeSub().prepare().stream('hi')}`)
  out.push(`   (分派链不经过 stream → 子类 override 死代码)`)
  out.push(`③ 门面直调(不经 prepare):stream("hi") → ${new FacadeStyle().stream('hi')}`)
  out.push(`   (stream 是 abstract 逼出来的转发方法——直调也是一条活路)`)
  wireObserver.calls = 0
  new FacadeStyle().prepare().stream('hi')
  new FacadeStyle().stream('hi')
  out.push(`   (汇合实测:两扇门各走一次,WireTransport.stream 执行 ${wireObserver.calls} 次——一套实现,不是两套)`)
  out.push(`④ 子类旁路直调:stream("hi") → ${new FacadeSub().stream('hi')}`)
  out.push(`   (直调同样晚绑定——override 死不死取决于走哪条路,不是方法本身)`)

  const detached = new DetachedStyle()
  try {
    detached.prepare().stream('hi')
    out.push('⑤ 解构姿势:不该到这里')
  } catch (err) {
    out.push(`⑤ 解构姿势:prepare().stream("hi") → ${err instanceof TypeError ? 'TypeError(this=undefined)' : String(err)}`)
  }
  out.push(`   (const s = this.stream 取出的瞬间 this 就丢了——箭头只捕获「自己的」外层 this,救不了别人)`)

  try {
    new SelfFacadeStyle().stream('hi')
    out.push('⑥ 自指门面:不该到这里')
  } catch (err) {
    out.push(`⑥ 自指门面:stream("hi") → ${err instanceof RangeError ? 'RangeError(栈溢出:无限递归)' : String(err)}`)
  }
  out.push(`   (自己当自己的内部对象 = 委托链没有基准情形;不需要别的工作对象,就不需要门面——那是姿势一)`)
  return out
}
