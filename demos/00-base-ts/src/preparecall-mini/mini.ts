/**
 * 目标:单元三「简化版 prepareCall」——把 demos/06 机制墙的机关孤立出来:同一种
 *       调用形态(obj.prepare().stream(x)),三种 prepare 写法,三种命运。
 * 思路:三姿势对照,全部只依赖单元一/二的两条原理(晚绑定引用的名字决定 override
 *       是否命中;闭包捕获的 this 决定 dispatch 的身份):
 *       基类姿势 = 闭包写 this.stream → 子类 override 生效(= LlmAdapter 缺省);
 *       门面姿势 = 体内 new 内部对象并转移调用 → override 死代码(= DeepSeekAdapter);
 *       解构姿势 = const s = this.stream 再调 s → this 丢失直接炸(反例,谁也别学)。
 * 对照:@deepseek-ai/dsh-llm 的 LlmAdapter 缺省 prepareCall(基类姿势);
 *       dsh-llm-deepseek 的 DeepSeekAdapter.prepareCall → implementation()(门面姿势);
 *       demos/06 registry/subclass-probe.ts(真实链路版探针 C/D)与 facade-pattern.ts;
 *       qa/03「机制墙的原理」节。
 */

/** prepareCall 的返回形状:一个元数据 + 一个 dispatch 闭包(= PreparedAdapterCall 骨架)。 */
export interface Prepared {
  stream: (msg: string) => string
}

/** 姿势一·基类(= LlmAdapter 缺省 prepareCall):箭头捕获 this,引用名字 stream。 */
export class BaseStyle {
  prepare(): Prepared {
    return { stream: (msg) => this.stream(msg) }
  }

  stream(msg: string): string {
    return `base.stream(${msg})`
  }
}

export class BaseSub extends BaseStyle {
  override stream(msg: string): string {
    return `SUB.stream(${msg})` // 生效:闭包引用的名字就是它
  }
}

/** 内部传输对象(= ChatCompletionsAdapter 骨架):自己打包自己的 dispatch。 */
class WireTransport {
  prepare(): Prepared {
    return { stream: (msg) => `wire(${msg})` }
  }
}

/** 姿势二·门面(= DeepSeekAdapter):每个方法都是转发,this 在 impl() 里换人。 */
export class FacadeStyle {
  impl(): WireTransport {
    return new WireTransport()
  }

  prepare(): Prepared {
    return this.impl().prepare()
  }

  stream(msg: string): string {
    return `facade.stream(${msg})`
  }
}

export class FacadeSub extends FacadeStyle {
  override stream(msg: string): string {
    return `SUB.stream(${msg})` // 死代码:分派链上没有 this.stream 这个引用
  }
}

/** 姿势三·解构(反例):方法从 this 上取下来,连箭头也救不了。 */
export class DetachedStyle {
  stamp = 'detached'

  prepare(): Prepared {
    const s = this.stream // 取出的瞬间,方法与 this 的关系就断了
    return { stream: (msg) => s(msg) }
  }

  stream(msg: string): string {
    return `detached.stream[${this.stamp}](${msg})` // 读 this.stamp:this 丢失则炸
  }
}

export function runPrepareCallExperiments(): string[] {
  const out: string[] = []
  const shape = 'p.stream("hi")' // runtime 视角的唯一调用形态,三姿势完全一致

  out.push(`① 基类姿势:${shape} → ${new BaseSub().prepare().stream('hi')}`)
  out.push(`   (闭包写 this.stream → 子类 override 生效)`)
  out.push(`② 门面姿势:${shape} → ${new FacadeSub().prepare().stream('hi')}`)
  out.push(`   (体内 new 内部对象 → override 死代码;旁路直调 sub.stream("hi") → ${new FacadeSub().stream('hi')})`)

  const detached = new DetachedStyle()
  try {
    detached.prepare().stream('hi')
    out.push('③ 解构姿势:不该到这里')
  } catch (err) {
    out.push(`③ 解构姿势:${shape} → ${err instanceof TypeError ? 'TypeError(this=undefined)' : String(err)}`)
  }
  out.push(`   (const s = this.stream 取出的瞬间 this 就丢了——箭头只捕获「自己的」外层 this,救不了别人)`)
  return out
}
