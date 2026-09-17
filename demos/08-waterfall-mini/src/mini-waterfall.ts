/**
 * 目标:教学版 waterfall——把 cordis 12 行机制的「值瀑布」与「流瀑布」两种形态
 *       同构重写一遍,零依赖、可观测、可测试。核心只有一句 `(queue.shift() ?? inner)`:
 *       洋葱的全部实现 = 队列(谁先谁后)+ 闭包(next 即「余下的链」)。
 * 思路:与 cordis 的对应关系——on()≈ctx.on(注册即插拔,返回注销器;支持 prepend
 *       插队链头);run()≈ctx.waterfall(payload, 内置行为)。每轮 run 对监听器列表
 *       拍快照,运行中新注册不影响本轮。两种瀑布共享同一个组合句型,载荷不同:
 *       值瀑布的 next() 返回决定值(Promise),流瀑布的 next() 返回异步迭代器。
 * 对照:cordis lib/index.js 的 Events.waterfall(12 行,qa/04 附录二逐行解剖);
 *       dsh 的 @mode waterfall 七道闸(agent/pre-step、agent/request、llm/stream、
 *       tools 三闸);qa/04-附录二(真包四组实测,行为与本教学版一致)。
 */

/** 监听器注册选项:prepend=true 插到链头(= 最外层 = 最后润色权)。 */
export interface ListenerOptions {
  prepend?: boolean
}

/** 值瀑布监听器:(当前的值, next) => 决定值。变换的正规通道是返回值,不是改共享值。 */
export type ValueListener<V> = (value: V, next: () => Promise<V>) => Promise<V>

/** 流瀑布监听器:(next) => 一个流。next() 拿到更内层的流,逐 chunk 经过并转发。 */
export type StreamListener<S> = (next: () => AsyncIterable<S>) => AsyncIterable<S>

function insert<T>(list: T[], item: T, options: ListenerOptions): () => void {
  if (options.prepend) list.unshift(item)
  else list.push(item)
  return () => {
    const at = list.indexOf(item)
    if (at >= 0) list.splice(at, 1)
  }
}

/** 值瀑布:监听器包裹式加工「决定值」,内→外交回,最外层最后润色。 */
export class ValueWaterfall<V> {
  private readonly listeners: Array<ValueListener<V>> = []

  /** 注册监听器,返回注销器。 */
  on(listener: ValueListener<V>, options: ListenerOptions = {}): () => void {
    return insert(this.listeners, listener, options)
  }

  /** 跑一遍瀑布:队列空了落到 inner(内置行为);不调 next 即否决一切内层。 */
  async run(value: V, inner: ValueListener<V>): Promise<V> {
    const queue = [...this.listeners] // 快照:运行中新注册不影响本轮
    const next = (): Promise<V> => {
      const listener: ValueListener<V> = queue.shift() ?? inner
      return listener(value, next)
    }
    return next()
  }
}

/** 流瀑布:同一个组合句型,载荷换成异步迭代器——chunk 流过监听器的手。 */
export class StreamWaterfall<S> {
  private readonly listeners: Array<StreamListener<S>> = []

  on(listener: StreamListener<S>, options: ListenerOptions = {}): () => void {
    return insert(this.listeners, listener, options)
  }

  async *run(inner: StreamListener<S>): AsyncIterable<S> {
    const queue = [...this.listeners]
    const next = (): AsyncIterable<S> => {
      const listener: StreamListener<S> = queue.shift() ?? inner
      return listener(next)
    }
    yield* next()
  }
}
