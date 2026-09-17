/**
 * 目标:幕三公共地基——prepareCall 的返回形状(= PreparedAdapterCall 骨架)与
 *       抽象根(= LlmAdapter 骨架),全部姿势共享。
 * 思路:Prepared = 一个 dispatch 闭包;AdapterRoot 的 abstract stream 逼所有
 *       具体子类实现它(NoStream 的 @ts-expect-error 即强制力证据);缺省
 *       prepare 的闭包写 this.stream——箭头捕获 this、引用名字 stream,
 *       这就是「基类血脉 override 生效」的全部机关。
 * 对照:@deepseek-ai/dsh-llm 的 LlmAdapter(abstract stream + 缺省 prepareCall:
 *       `stream: (options) => this.stream(options)`);幕一④(晚绑定引用)。
 */

/** prepareCall 的返回形状:一个 dispatch 闭包(= PreparedAdapterCall 骨架)。 */
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
