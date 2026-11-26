import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FileSweepStore, MemorySweepStore, SweepMode, SweepRunner, SweepSnapshot } from './types.js'

const DEFAULT_HISTORY_PATH = fileURLToPath(new URL('../../../data/sweep-history.json', import.meta.url))
const MAX_HISTORY = 50

// 模式存内存、重启回默认（选项 1 的刻意取舍：热切换但不持久）
let currentMode: SweepMode = 'memory'

export function getSweepMode(): SweepMode {
  return currentMode
}

export function setSweepMode(mode: SweepMode): void {
  currentMode = mode
}

export function createMemorySweepStore(): MemorySweepStore {
  let latest: SweepSnapshot | null = null

  return {
    setLatest(snapshot) {
      latest = snapshot
    },
    getLatest() {
      return latest
    },
  }
}

export function createFileSweepStore(filePath: string = DEFAULT_HISTORY_PATH): FileSweepStore {
  // 读失败只 warn 并当空历史，不改用户原文件；写入时重建结构
  function readHistory(): SweepSnapshot[] {
    if (!existsSync(filePath)) return []

    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { snapshots?: unknown }
      if (!Array.isArray(parsed?.snapshots)) {
        console.warn(`[sweep] 历史文件结构异常，按空历史处理：${filePath}`)
        return []
      }
      return parsed.snapshots as SweepSnapshot[]
    } catch (error) {
      console.warn(`[sweep] 历史文件解析失败，按空历史处理：${filePath}`, error)
      return []
    }
  }

  return {
    append(snapshot) {
      const history = [...readHistory(), snapshot].slice(-MAX_HISTORY)
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, JSON.stringify({ version: 1, snapshots: history }, null, 2), 'utf8')
    },
    list() {
      return readHistory()
    },
  }
}

// 模块级 live binding：测试/启动时用 setter 覆盖，router 每次请求读
export let activeSweepRunner: SweepRunner | null = null

export function setSweepRunner(runner: SweepRunner): void {
  activeSweepRunner = runner
}

export let activeMemoryStore: MemorySweepStore = createMemorySweepStore()

export function setMemoryStore(store: MemorySweepStore): void {
  activeMemoryStore = store
}

export let activeFileStore: FileSweepStore = createFileSweepStore(DEFAULT_HISTORY_PATH)

export function setFileStore(store: FileSweepStore): void {
  activeFileStore = store
}
