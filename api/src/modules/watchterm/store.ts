import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WatchCategory, WatchTerm } from './types.js'

export const DUPLICATE_CODE = 'DUPLICATE'

interface StoreFile {
  version: number
  terms: WatchTerm[]
}

export interface WatchTermStore {
  list(): WatchTerm[]
  add(text: string, category: WatchCategory): WatchTerm
  remove(id: string): boolean
  toggle(id: string): WatchTerm | null
}

export function createWatchTermStore(filePath: string): WatchTermStore {
  // 坏文件只 warn + 当空库，不删改原文件；下次写入时重建结构
  function readAll(): WatchTerm[] {
    if (!existsSync(filePath)) {
      writeAll([])
      return []
    }

    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<StoreFile>
      if (!parsed || !Array.isArray(parsed.terms)) {
        throw new Error('terms 不是数组')
      }
      return parsed.terms
    } catch (error) {
      console.warn(`[watchterm] 读取失败，按空库处理：${(error as Error).message}（${filePath}）`)
      return []
    }
  }

  // 写临时文件再原子替换，避免半截文件
  function writeAll(terms: WatchTerm[]): void {
    mkdirSync(dirname(filePath), { recursive: true })
    const payload: StoreFile = { version: 1, terms }
    const tmpPath = `${filePath}.tmp`
    writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8')
    renameSync(tmpPath, filePath)
  }

  return {
    // createdAt 倒序；同一毫秒内后写入的排在前
    list() {
      return readAll()
        .map((term, index) => ({ term, index }))
        .sort(
          (a, b) =>
            Date.parse(b.term.createdAt) - Date.parse(a.term.createdAt) || b.index - a.index
        )
        .map(({ term }) => term)
    },

    add(text, category) {
      const normalized = text.trim()
      const terms = readAll()

      if (terms.some((term) => term.text === normalized)) {
        throw Object.assign(new Error('duplicate'), { code: DUPLICATE_CODE })
      }

      const term: WatchTerm = {
        id: randomUUID(),
        text: normalized,
        category,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      writeAll([...terms, term])
      return term
    },

    remove(id) {
      const terms = readAll()
      const next = terms.filter((term) => term.id !== id)
      if (next.length === terms.length) return false
      writeAll(next)
      return true
    },

    toggle(id) {
      const terms = readAll()
      const target = terms.find((term) => term.id === id)
      if (!target) return null

      const updated: WatchTerm = { ...target, isActive: !target.isActive }
      writeAll(terms.map((term) => (term.id === id ? updated : term)))
      return updated
    },
  }
}

const DEFAULT_FILE_PATH = fileURLToPath(new URL('../../../data/watch-terms.json', import.meta.url))

// 可变实例：测试通过 setWatchTermStore 注入临时 store；router 每次请求读 live binding
export let activeStore: WatchTermStore = createWatchTermStore(DEFAULT_FILE_PATH)

export function setWatchTermStore(store: WatchTermStore): void {
  activeStore = store
}
