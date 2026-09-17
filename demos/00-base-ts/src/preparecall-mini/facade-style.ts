/**
 * 目标:姿势②③·门面血脉——prepare 改写为「体内 new 内部对象并转移调用」,
 *       子类 override 在分派链上死代码;stream 被 abstract 逼着挂,选择实现成
 *       「转发给内部对象」,于是直调(不经 prepare)也是一条活路。
 * 思路:receiver 在 impl() 里换人——内部对象 WireTransport 是委托链的基准情形
 *       (真正干活的工作对象)。门面的 stream 不是第二套实现,是转发:一套代码
 *       (WireTransport.stream),两扇门(prepare 闭包 / stream 转发),殊途同归
 *       ——wireObserver 计数器就是汇合证明。
 * 对照:dsh-llm-deepseek 的 DeepSeekAdapter(prepareCall → this.implementation()
 *       .prepareCall();stream → this.implementation().stream(options));
 *       demos/06 registry/subclass-probe.ts 探针 C/D。
 */
import { AdapterRoot } from './prepared.ts'
import type { Prepared } from './prepared.ts'

/** 观测计数器:证明两扇门汇合到同一段 WireTransport.stream 代码(一套实现,不是两套)。 */
export const wireObserver = { calls: 0 }

/** 内部传输对象(= ChatCompletionsAdapter 骨架):自己打包自己的 dispatch,也有直调口。 */
class WireTransport {
  stream(msg: string): string {
    wireObserver.calls += 1
    return `wire(${msg})`
  }

  prepare(): Prepared {
    return { stream: (msg) => this.stream(msg) }
  }
}

/** 门面血脉(= DeepSeekAdapter):prepare 改写为转移;stream 被逼实现,选择转发。 */
export class FacadeStyle extends AdapterRoot {
  impl(): WireTransport {
    return new WireTransport()
  }

  override prepare(): Prepared {
    return this.impl().prepare() // ★ receiver 在此换人
  }

  stream(msg: string): string {
    return this.impl().stream(msg) // 转发实现:直调也是一条活路
  }
}

export class FacadeSub extends FacadeStyle {
  override stream(msg: string): string {
    return `SUB.stream(${msg})` // 分派链上死代码;直调路上活代码
  }
}
