import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSweepRunner, startSweepScheduler } from '../src/modules/sweep/runner.js'
import { createFileSweepStore, createMemorySweepStore } from '../src/modules/sweep/store.js'
import type { Beacon } from '../src/modules/beacon/types.js'
import type { SweepMode } from '../src/modules/sweep/types.js'

const beacons: Beacon[] = Array.from({ length: 6 }, (_, i) => ({
  id: `hn-${i + 1}`,
  title: `AI news ${i + 1}`,
  url: `https://example.com/${i + 1}`,
  source: 'fake',
  score: 10 - i,
  publishedAt: '2026-11-26T00:00:00.000Z',
}))

function makeFileStore(t: { after(fn: () => void): void }) {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-runner-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return createFileSweepStore(join(dir, 'sweep-history.json'))
}

test('快照字段齐全、model 回传、最多审 5 条命中项', async (t) => {
  const memoryStore = createMemorySweepStore()
  const auditCalls: string[] = []
  let mode: SweepMode = 'memory'

  const runner = createSweepRunner({
    collectBeacons: async () => beacons,
    matchBeacons: () => beacons.map((beacon) => ({ beaconId: beacon.id, matchedTerms: ['AI'] })),
    audit: async (title) => {
      auditCalls.push(title)
      return { isReal: true, reason: '相关', degraded: false }
    },
    listTerms: () => [],
    resolveModel: (requested) => requested ?? 'default-model',
    getMode: () => mode,
    memoryStore,
    fileStore: makeFileStore(t),
  })

  const snapshot = await runner.run('requested-model')

  assert.ok(!Number.isNaN(Date.parse(snapshot.sweptAt)), `sweptAt 应可解析，实际 ${snapshot.sweptAt}`)
  assert.equal(snapshot.beacons.length, 6, '应带上全部抓取结果')
  assert.equal(snapshot.matches.length, 6, '应带上全部匹配结果')
  assert.equal(snapshot.audits.length, 5, '最多只审 5 条')
  assert.equal(auditCalls.length, 5, 'AI 调用次数应与审核条数一致')
  assert.equal(snapshot.model, 'requested-model', '应回传本次请求的模型')
  assert.equal(snapshot.status, 'ok', '全部成功时状态应为 ok')
  assert.equal(memoryStore.getLatest()?.sweptAt, snapshot.sweptAt, 'memory 模式应写入内存')
})

test('三种模式各写各的；抓取失败返回 degraded 空快照而不抛错', async (t) => {
  async function runWithMode(mode: SweepMode, collect: () => Promise<Beacon[]>) {
    let memoryWrites = 0
    let fileWrites = 0
    const runner = createSweepRunner({
      collectBeacons: collect,
      matchBeacons: () => [],
      audit: async () => ({ isReal: true, reason: '', degraded: false }),
      listTerms: () => [],
      resolveModel: () => 'model',
      getMode: () => mode,
      memoryStore: {
        setLatest() {
          memoryWrites += 1
        },
        getLatest: () => null,
      },
      fileStore: {
        append() {
          fileWrites += 1
        },
        list: () => [],
      },
    })
    const snapshot = await runner.run()
    return { snapshot, memoryWrites, fileWrites }
  }

  const memoryRun = await runWithMode('memory', async () => beacons)
  assert.equal(memoryRun.memoryWrites, 1, 'memory 模式只写内存')
  assert.equal(memoryRun.fileWrites, 0, 'memory 模式不写文件')

  const fileRun = await runWithMode('file', async () => beacons)
  assert.equal(fileRun.memoryWrites, 0, 'file 模式不写内存')
  assert.equal(fileRun.fileWrites, 1, 'file 模式只写文件')

  const bothRun = await runWithMode('both', async () => beacons)
  assert.equal(bothRun.memoryWrites, 1, 'both 模式写内存')
  assert.equal(bothRun.fileWrites, 1, 'both 模式写文件')

  const degraded = await runWithMode('both', async () => {
    throw new Error('collect failed')
  })
  assert.equal(degraded.snapshot.status, 'degraded', '抓取失败应标记 degraded')
  assert.deepEqual(degraded.snapshot.beacons, [], '失败时快照应为空')
})

test('isRunning 防重叠、异常后 finally 重置，定时器按 intervalMs 触发并可停止', async (t) => {
  let collectCalls = 0
  let release: (value: Beacon[]) => void = () => {}
  const gate = new Promise<Beacon[]>((resolve) => {
    release = resolve
  })

  const runner = createSweepRunner({
    collectBeacons: async () => {
      collectCalls += 1
      return gate
    },
    matchBeacons: () => [],
    audit: async () => ({ isReal: true, reason: '', degraded: false }),
    listTerms: () => [],
    resolveModel: () => 'model',
    getMode: () => 'memory',
    memoryStore: createMemorySweepStore(),
    fileStore: makeFileStore(t),
  })

  const first = runner.run()
  assert.equal(runner.isRunning(), true, '运行中 isRunning 应为 true')

  await runner.run().catch(() => undefined)
  assert.equal(collectCalls, 1, '运行中再次触发应被跳过')

  release(beacons)
  await first
  assert.equal(runner.isRunning(), false, '跑完后应重置 isRunning')

  const failing = createSweepRunner({
    collectBeacons: async () => {
      throw new Error('boom')
    },
    matchBeacons: () => [],
    audit: async () => ({ isReal: true, reason: '', degraded: false }),
    listTerms: () => [],
    resolveModel: () => 'model',
    getMode: () => 'memory',
    memoryStore: createMemorySweepStore(),
    fileStore: makeFileStore(t),
  })
  await failing.run()
  assert.equal(failing.isRunning(), false, '异常后 finally 也应重置 isRunning')

  let captured: { cb: () => void; ms: number } | null = null
  let cleared: unknown = null
  let runs = 0
  const stop = startSweepScheduler({
    run: async () => {
      runs += 1
    },
    intervalMs: 1800000,
    setIntervalFn: ((cb: () => void, ms: number) => {
      captured = { cb, ms }
      return 42 as unknown as NodeJS.Timeout
    }) as unknown as typeof setInterval,
  })

  assert.equal(captured?.ms, 1800000, '应按传入的 intervalMs 注册定时器')
  captured?.cb()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(runs, 1, '定时器回调应触发一次巡检')

  const originalClear = globalThis.clearInterval
  globalThis.clearInterval = ((handle: unknown) => {
    cleared = handle
  }) as typeof clearInterval
  t.after(() => {
    globalThis.clearInterval = originalClear
  })
  stop()
  assert.equal(cleared, 42, '停止函数应 clearInterval 对应句柄')
})
