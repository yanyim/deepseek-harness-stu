/**
 * 目标:单元三「简化版 prepareCall」——把 demos/06 机制墙的机关孤立出来:同一种
 *       调用形态,不同的 prepare 写法,不同的命运;并如实还原「门面为什么挂 stream」。
 * 思路:一个抽象根(= LlmAdapter 骨架):abstract stream 逼所有具体子类实现它——
 *       不挂编译不过(文件内 NoStream 即证据);缺省 prepare 的闭包写 this.stream,
 *       所以「用缺省 prepare 的血脉」override 生效。门面血脉改写 prepare 为转移,
 *       同时被迫实现 stream——它选择实现成「转发给内部对象」,于是直调也是活路。
 *       四路对照矩阵证明:override 死不死取决于「走哪条路」,不是方法本身。
 *       末尾解构姿势是反例:方法从 this 上取下来,this 直接丢。
 * 对照:@deepseek-ai/dsh-llm 的 LlmAdapter(abstract stream + 缺省 prepareCall:
 *       `stream: (options) => this.stream(options)`);dsh-llm-deepseek 的
 *       DeepSeekAdapter(门面:prepareCall 转移给 implementation();stream 实现
 *       为转发 `this.implementation().stream(options)`);demos/06 registry/
 *       subclass-probe.ts 与 facade-pattern.ts;qa/03「机制墙的原理」节。
 */

/** prepareCall 的返回形状:一个元数据 + 一个 dispatch 闭包(= PreparedAdapterCall 骨架)。 */
export interface Prepared {
  stream: (msg: string) => string
}

/** 抽象根(= LlmAdapter 骨架):stream 是唯一抽象成员,缺省 prepare 引用 this.stream。 */
export abstract class AdapterRoot {
  abstract stream(msg: string): string

  prepare(): Prepared {
    return { stream: (msg) => this.stream(msg) } // 箭头捕获 this,引用名字 stream
  }
}

// @ts-expect-error abstract 的强制力本身是测试:不实现 stream,这个类编译不过。
// 门面「挂 stream」的第一层原因就在这——不是它想挂,是根逼的。
class NoStream extends AdapterRoot {}

/** 基类姿势血脉:不碰 prepare(用缺省),只实现 stream → 分派链命中子类实现。 */
export class BaseSub extends AdapterRoot {
  stream(msg: string): string {
    return `SUB.stream(${msg})`
  }
}

/** 内部传输对象(= ChatCompletionsAdapter 骨架):自己打包自己的 dispatch,也有直调口。 */
class WireTransport {
  stream(msg: string): string {
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

/** 解构姿势(反例):方法从 this 上取下来,连箭头也救不了。 */
export class DetachedStyle extends AdapterRoot {
  stamp = 'detached'

  override prepare(): Prepared {
    const s = this.stream // 取出的瞬间,方法与 this 的关系就断了
    return { stream: (msg) => s(msg) }
  }

  stream(msg: string): string {
    return `detached.stream[${this.stamp}](${msg})` // 读 this.stamp:this 丢失则炸
  }
}

/** 姿势四·自指(反例,qa 追问):门面自己当自己的内部对象——委托链没有基准情形:
 *  stream 转发 impl(),impl() 又 new 一个自己,新自己再转发……无限递归,栈溢出。
 *  教训:门面的意义恰恰是「工作由别的对象做」;若不需要别的工作对象,就根本
 *  不需要门面——直接写姿势一那样的直活实现即可。 */
export class SelfFacadeStyle extends AdapterRoot {
  impl(): SelfFacadeStyle {
    return new SelfFacadeStyle() // 内部对象 = 另一个我(没有基准情形)
  }

  override prepare(): Prepared {
    return this.impl().prepare()
  }

  stream(msg: string): string {
    return this.impl().stream(msg)
  }
}

export function runPrepareCallExperiments(): string[] {
  const out: string[] = []

  out.push(`① 基类姿势(用缺省 prepare):prepare().stream("hi") → ${new BaseSub().prepare().stream('hi')}`)
  out.push(`   (闭包写 this.stream → 子类 stream 生效)`)
  out.push(`② 门面姿势(prepare 改写为转移):prepare().stream("hi") → ${new FacadeSub().prepare().stream('hi')}`)
  out.push(`   (分派链不经过 stream → 子类 override 死代码)`)
  out.push(`③ 门面直调(不经 prepare):stream("hi") → ${new FacadeStyle().stream('hi')}`)
  out.push(`   (stream 是 abstract 逼出来的转发方法——直调也是一条活路)`)
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
