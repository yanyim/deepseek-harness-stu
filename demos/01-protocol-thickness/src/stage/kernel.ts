/**
 * 【舞台 & 解法④】迷你内核 —— 同时是「太厚→失控」的第一个解法展品
 *
 * 目标:内核承担组合这个元问题,不承载任何 Agent 领域功能 —— 因此它没有理由变厚。
 * 思路:只保留四个领域无关原语,一切注册皆可逆副作用(卸载逆序撤销、嵌套插件卸父必卸子)。
 * 对照:dsh 的 Cordis(vendor/cordis);刻意省略 inject 依赖等待、isolate 作用域、fiber。
 *
 *   provide()  服务:一个名字占一个坑,可替换、可撤销
 *   on()       事件:emit 广播(观察者)/ waterfall 中间件链(可拦截、可改写、可否决)
 *   effect()   副作用:一切注册都登记一个逆操作
 *   plugin()   插件:apply(ctx) 期间的注册全部挂在该插件名下
 */

export type Disposer = () => void

/**
 * 统一监听器签名:dsh 在事件声明上用 @mode 区分 emit / waterfall;
 * 迷你内核用返回值区分 —— emit 观察者可返回 void(被忽略),
 * waterfall 监听器必须返回 payload(或调用 next 委托下去)。
 */
export type EventListener<P> = (
  payload: P,
  next: (payload: P) => Promise<P>,
) => unknown

export class Context {
  /** 测试里关掉,免得装载/卸载日志刷屏 */
  static logging = true

  #services = new Map<string, unknown>()
  #listeners = new Map<string, Array<EventListener<any>>>()
  #frame: Disposer[] | null = null

  /** 登记一个可逆副作用。必须在 plugin() 内调用 —— 一切注册都要有插件主人 */
  effect(dispose: Disposer): Disposer {
    if (!this.#frame) {
      throw new Error('注册必须发生在 plugin() 之内:一切副作用都要有插件主人')
    }
    this.#frame.push(dispose)
    return dispose
  }

  /** 加载插件:apply 期间的一切注册都挂在这个插件名下 */
  plugin(name: string, apply: (ctx: Context) => void): Disposer {
    if (Context.logging) console.log(`[plugin] 装载 ${name}`)
    const frame: Disposer[] = []
    const outer = this.#frame
    this.#frame = frame
    try {
      apply(this)
    } finally {
      this.#frame = outer
    }
    const unload = () => {
      if (Context.logging) console.log(`[plugin] 卸载 ${name}`)
      for (const dispose of frame.reverse()) dispose()
    }
    // 嵌套装载:子插件的卸载是父插件的副作用 —— 卸父必卸子,单独卸子也不影响父
    if (outer) outer.push(unload)
    return unload
  }

  /** 提供服务;同名服务可被后来者替换,撤销时恢复前者 */
  provide<T>(key: string, factory: (ctx: Context) => T): T {
    const value = factory(this)
    const previous = this.#services.get(key)
    this.#services.set(key, value)
    this.effect(() => {
      if (this.#services.get(key) === value) {
        if (previous === undefined) this.#services.delete(key)
        else this.#services.set(key, previous)
      }
    })
    return value
  }

  use<T>(key: string): T {
    const value = this.#services.get(key)
    if (value === undefined) throw new Error(`服务未注册:${key}`)
    return value as T
  }

  on<P>(event: string, listener: EventListener<P>): Disposer {
    const list = this.#listeners.get(event) ?? []
    list.push(listener as EventListener<any>)
    this.#listeners.set(event, list)
    return this.effect(() => {
      const current = this.#listeners.get(event)
      const at = current?.indexOf(listener as EventListener<any>) ?? -1
      if (at >= 0) current!.splice(at, 1)
    })
  }

  /** 广播:观察者模式,返回值被忽略(观察者失败不该影响提交) */
  emit<P>(event: string, payload: P): void {
    for (const listener of [...(this.#listeners.get(event) ?? [])]) {
      listener(payload, async (p) => p)
    }
  }

  /** 瀑布:监听器按注册顺序组成中间件链,可改写 payload,throw 即否决 */
  async waterfall<P>(event: string, payload: P): Promise<P> {
    const listeners = [...(this.#listeners.get(event) ?? [])]
    const dispatch = async (current: P, index: number): Promise<P> => {
      if (index >= listeners.length) return current
      const result = await listeners[index](current, (next) => dispatch(next, index + 1))
      return (result ?? current) as P
    }
    return dispatch(payload, 0)
  }
}
