/**
 * 目标:公共地基——以子进程方式跑真实 dsh CLI(--profile headless --patch),
 *       demo 串场与 e2e 测试共用同一入口:同一份组合数据、同一条启动路径。
 * 思路:bin 用 process.execPath + 仓库内 node_modules 的 dsh/lib/bin.js(不依赖
 *       npx 的 PATH 解析,CI 可复现);DSH_HOME 必须显式传入以隔离会话与配置;
 *       patch 传绝对路径。插件名的解析基准是 patch 文件所在目录(0.1.6 实测,
 *       dsh-app-boot 的 boot() 以 dirname(configPath) 设 baseUrl)——跨目录复用
 *       插件时,插件名要写 file:// 绝对 URL(测试的变体 patch 就这么做)。
 * 对照:教程 demos/05-headless-mock 的 `npx dsh` 用法;dsh 源码 packages/cli
 *       与 packages/boot;demos/05-loading-mechanisms(import 第二个输入的续集)。
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export interface HeadlessRun {
  status: number | null
  stdout: string
  stderr: string
}

/** dsh CLI 的 bin(仓库 node_modules 内,与能力包同版本 0.1.6-alpha.1)。 */
const DSH_BIN = fileURLToPath(new URL('../../../node_modules/@deepseek-ai/dsh/lib/bin.js', import.meta.url))

export function runHeadless(options: {
  home: string
  patch: string
  task?: string
  extraArgs?: string[]
  timeoutMs?: number
}): Promise<HeadlessRun> {
  const { home, patch, task, extraArgs = [], timeoutMs = 120_000 } = options
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      DSH_BIN,
      '--profile', 'headless',
      '--patch', patch,
      ...(task !== undefined ? [task] : []),
      ...extraArgs,
    ], { env: { ...process.env, DSH_HOME: home } })

    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout?.on('data', (c: Buffer) => out.push(c))
    child.stderr?.on('data', (c: Buffer) => err.push(c))

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`dsh 子进程超时(${timeoutMs}ms)`))
    }, timeoutMs)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (status) => {
      clearTimeout(timer)
      resolve({ status, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() })
    })
  })
}
