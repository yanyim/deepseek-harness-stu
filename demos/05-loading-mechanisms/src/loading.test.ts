/**
 * 目标:锁定 demo 05 的行为——前门身份(住址决定货)、后门指定身份、同一本模块账、
 *       解析起点决定终点;以及无旗子时两扇门关闭、优雅降级。
 * 思路:spawn 真实 node 子进程跑 main.ts(有/无 --expose-internals 各一次)——
 *       内部加载器属于进程级状态,子进程是唯一忠实的考场;路径行做仓库根归一化。
 * 对照:qa/02 附录四 §1.5(两档机制);cordis-plugin-loader 的 no-internals 降级。
 */
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'

const mainPath = fileURLToPath(new URL('./main.ts', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

function runMain(withFlag: boolean): string[] {
  const args = withFlag ? ['--expose-internals', mainPath] : [mainPath]
  const stdout = execFileSync(process.execPath, args, { encoding: 'utf8' })
  return stdout.trim().split('\n').map((line) => line.replace(repoRoot, '<repo>/'))
}

describe('demo 05 · import 的第二个输入:两种加载机制', () => {
  it('带旗子:四实验全跑,前门身份/后门指定/同一本账/起点决定终点', () => {
    expect(runMain(true)).toEqual([
      '[模式] --expose-internals:开;内部加载器档:可用',
      "[实验一·前门] 同一句 await import('twin-pkg'),写在两个世界的文件里:",
      '  住在 world-a 的文件拿到 = A',
      '  住在 world-b 的文件拿到 = B',
      '  身份(文件住址)决定你看见谁;await import 的身份不可指定——这就是"按本人身份办理"',
      '[实验二·后门] 同一句查询,身份(parentURL)是我传的参数:',
      '  import(\'twin-pkg\', world-a) = A',
      "  import('twin-pkg', world-b) = B",
      '  loader 插件就是这样以 ctx.baseUrl 为身份加载用户插件的裸包名',
      '[实验三·同一本账] Symbol 指纹比对(每个模块实例的 marker 唯一):',
      '  内部档两次取 world-a:同实例? 是',
      '  内部档 vs 前门(world-a 同一 URL 两条路):同实例? 是——进程只有一本模块缓存',
      '  跨世界对照:world-a vs world-b 的实例? 不同(正确的两份——URL 不同,理应两份)',
      '[实验四·resolveSync] 同一查询、不同起点,摊开看:',
      '  twin-pkg @ world-a → <repo>/demos/05-loading-mechanisms/fixtures/world-a/node_modules/twin-pkg/index.js',
      '  twin-pkg @ world-b → <repo>/demos/05-loading-mechanisms/fixtures/world-b/node_modules/twin-pkg/index.js',
      "  dsh-tools @ /private/tmp → ❌ Cannot find package '@deepseek-ai/dsh-tools' imported from /",
      '  dsh-tools @ 仓库根 → ✅ <repo>/…/node_modules',
    ])
  })

  it('无旗子:两扇门关闭,前门实验照常,内部档优雅降级(loader 插件同名形态走兜底)', () => {
    expect(runMain(false)).toEqual([
      '[模式] --expose-internals:关;内部加载器档:不可用(→cordis-plugin-loader 此形态走兜底档:相对路径 new URL(name, baseUrl),裸包名按 loader 包自身位置解析)',
      "[实验一·前门] 同一句 await import('twin-pkg'),写在两个世界的文件里:",
      '  住在 world-a 的文件拿到 = A',
      '  住在 world-b 的文件拿到 = B',
      '  身份(文件住址)决定你看见谁;await import 的身份不可指定——这就是"按本人身份办理"',
      '[实验二~四·跳过] 内部档不可用(两扇门均未开)。带旗子重跑可看全:node --expose-internals src/main.ts',
    ])
  })
})
