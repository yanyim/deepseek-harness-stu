// 前门助手:住在本文件的位置(world-a)。它写的 await import('twin-pkg')
// 由「本文件的 URL」出发解析 → 永远拿到 world-a 的货。
export async function load() {
  return import('twin-pkg')
}
