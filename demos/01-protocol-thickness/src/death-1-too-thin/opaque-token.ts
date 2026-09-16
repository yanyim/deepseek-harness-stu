/**
 * 【死法一 · 解法③】不透明令牌防腐 —— 堵住「协议被实现细节反向污染」的入口
 *
 * 目标:透传参数腐化的真正入口,是消费方开始解析协议里的实现细节
 *       (「这个 key 其实是个路径,我 split 一下」)。要让这个诱惑在类型层就不成立。
 * 思路:品牌化不透明类型(Brand)—— 运行时仍是 string,但类型系统从此区分
 *       「任意字符串」与「FsTargetKey」;消费方只能持有、传递、还给后端。
 *       本地后端放 realpath,远程后端放 URI/文件 id,同一个消费函数一行不改。
 * 对照:packages/fs/fs 的 FsTargetKey / FsVersion(源码注释:"Consumers MUST NOT parse it")。
 */

export type Brand<T, B extends string> = T & { readonly __brand: B }

export type FsTargetKey = Brand<string, 'FsTargetKey'>

export interface FsBackend {
  /** 把模型/用户给的路径解析成稳定的不透明身份;此后一切操作只认它 */
  resolve(path: string): FsTargetKey
  read(key: FsTargetKey): string
}

export function localBackend(root: string): FsBackend {
  return {
    resolve: (path) => `${root}/${path}` as FsTargetKey,
    read: (key) => `<本地文件 ${key} 的内容>`,
  }
}

export function remoteBackend(endpoint: string): FsBackend {
  let next = 0
  const files = new Map<string, string>()
  return {
    resolve: (path) => {
      const key = `${endpoint}#file-${next++}`
      files.set(key, `<远程对象 ${path} 的内容>`)
      return key as FsTargetKey
    },
    read: (key) => files.get(key) ?? '<远程字节流>',
  }
}

/** 消费方:对后端一无所知 —— 换后端,这行代码不动(dsh:fs-local ↔ fs-e2b 同理) */
export function previewFile(backend: FsBackend, path: string): string {
  const key = backend.resolve(path)
  // 想在这里 key.split('/') 探测是不是本地路径?类型上是 FsTargetKey 不是 string;
  // 运行时虽然仍是 string,但「MUST NOT parse」写进了类型契约 —— 违反它是显式的越界。
  return backend.read(key)
}
