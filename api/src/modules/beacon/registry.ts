import { createHackerNewsSource } from './sources/hackernews.js'
import type { Beacon, BeaconSource } from './types.js'

// 可变注册表：测试通过清空 + push 注入假源（各测试文件独立进程）
export const beaconSources: BeaconSource[] = [createHackerNewsSource()]

// 默认参数在每次调用时求值，引用数组本身，不在模块加载时快照
export async function collectBeacons(sources: BeaconSource[] = beaconSources): Promise<Beacon[]> {
  const results = await Promise.all(sources.map((source) => source.collect()))
  return results.flat().sort((a, b) => b.score - a.score)
}
