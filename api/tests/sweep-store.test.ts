import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createFileSweepStore,
  createMemorySweepStore,
  getSweepMode,
  setSweepMode,
} from '../src/modules/sweep/store.js'
import type { SweepSnapshot } from '../src/modules/sweep/types.js'

function snapshot(sweptAt: string): SweepSnapshot {
  return {
    sweptAt,
    beacons: [],
    matches: [],
    audits: [],
    model: 'test-model',
    status: 'ok',
  }
}

test('内存 store 的 set/get 与 mode 默认值、set/get', () => {
  const store = createMemorySweepStore()
  assert.equal(store.getLatest(), null, '新内存 store 应为空')

  const first = snapshot('2026-11-26T00:00:00.000Z')
  store.setLatest(first)
  assert.deepEqual(store.getLatest(), first, '应读回最近一次写入的快照')

  const second = snapshot('2026-11-26T01:00:00.000Z')
  store.setLatest(second)
  assert.equal(store.getLatest()?.sweptAt, '2026-11-26T01:00:00.000Z', '只保留最新一份')

  assert.equal(getSweepMode(), 'memory', '默认模式应为 memory')
  setSweepMode('file')
  assert.equal(getSweepMode(), 'file', 'setSweepMode 应即时生效')
  setSweepMode('memory')
})

test('文件 store：文件不存在返回空历史，append 后可按顺序读回', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-store-'))
  const filePath = join(dir, 'sweep-history.json')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const store = createFileSweepStore(filePath)
  assert.deepEqual(store.list(), [], '文件不存在时应返回空历史')
  assert.equal(existsSync(filePath), false, '只读不应创建文件')

  store.append(snapshot('2026-11-26T00:00:00.000Z'))
  store.append(snapshot('2026-11-26T01:00:00.000Z'))

  const list = store.list()
  assert.equal(list.length, 2, '应读回 2 条历史')
  assert.equal(list[0]?.sweptAt, '2026-11-26T00:00:00.000Z', '顺序应为写入顺序')
  assert.equal(list[1]?.sweptAt, '2026-11-26T01:00:00.000Z')
})

test('文件 store：坏文件只 warn 不改原文件，写入时重建；历史最多 50 条', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-store-bad-'))
  const filePath = join(dir, 'sweep-history.json')
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const broken = '{ this is not json'
  writeFileSync(filePath, broken, 'utf8')

  const originalWarn = console.warn
  const warnings: string[] = []
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  }
  t.after(() => {
    console.warn = originalWarn
  })

  const store = createFileSweepStore(filePath)
  assert.deepEqual(store.list(), [], '坏文件应当作空历史')
  assert.ok(warnings.length > 0, '坏文件应打印 warn')
  assert.equal(readFileSync(filePath, 'utf8'), broken, '不应删除或改写用户原文件')

  store.append(snapshot('2026-11-26T02:00:00.000Z'))
  assert.equal(store.list().length, 1, '写入时应重建结构并可读回')

  for (let i = 0; i < 55; i += 1) {
    store.append(snapshot(`2026-11-27T${String(i).padStart(2, '0')}:00:00.000Z`))
  }
  const capped = store.list()
  assert.equal(capped.length, 50, '历史最多保留 50 条')
  assert.equal(capped[0]?.sweptAt, '2026-11-27T05:00:00.000Z', '超出时应丢最旧的')
  assert.equal(capped[49]?.sweptAt, '2026-11-27T54:00:00.000Z', '最后一条应是最新写入')
})
