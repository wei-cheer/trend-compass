import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { sweepRouter } from '../src/modules/sweep/router.js'
import {
  createFileSweepStore,
  createMemorySweepStore,
  setFileStore,
  setMemoryStore,
  setSweepMode,
  setSweepRunner,
} from '../src/modules/sweep/store.js'
import type { SweepRunner } from '../src/modules/sweep/types.js'

function snapshot(sweptAt: string) {
  return { sweptAt, beacons: [], matches: [], audits: [], model: 'fake-model', status: 'ok' as const }
}

async function startApp(t: { after(fn: () => void): void }, runner: SweepRunner) {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-contract-'))
  setSweepMode('memory')
  setSweepRunner(runner)
  setMemoryStore(createMemorySweepStore())
  setFileStore(createFileSweepStore(join(dir, 'sweep-history.json')))

  const app = express()
  app.use(express.json())
  app.use('/api/sweep', sweepRouter)

  const server = app.listen(0)
  t.after(() => {
    server.close()
    rmSync(dir, { recursive: true, force: true })
  })
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}`
}

test('GET latest 返回 mode/latest/history，POST settings 切换后回读，非法 mode 400', async (t) => {
  const runner: SweepRunner = { run: async () => snapshot('2026-11-26T00:00:00.000Z'), isRunning: () => false }
  const base = await startApp(t, runner)

  const latestRes = await fetch(`${base}/api/sweep/latest`)
  assert.equal(latestRes.status, 200, `GET latest 期望 200，实际 ${latestRes.status}`)
  const latest = (await latestRes.json()) as { mode?: string; latest?: unknown; history?: unknown }
  assert.equal(latest.mode, 'memory', '默认模式应为 memory')
  assert.equal(latest.latest, null, '无快照时 latest 应为 null')
  assert.deepEqual(latest.history, [], 'memory 模式 history 应为空数组')

  const settingsRes = await fetch(`${base}/api/sweep/settings`)
  assert.equal(settingsRes.status, 200)
  const settings = (await settingsRes.json()) as { mode?: string; intervalMs?: number }
  assert.equal(settings.mode, 'memory')
  assert.equal(settings.intervalMs, 1800000, '默认巡检间隔应为 30 分钟')

  const switchRes = await fetch(`${base}/api/sweep/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'both' }),
  })
  assert.equal(switchRes.status, 200, `切换模式期望 200，实际 ${switchRes.status}`)
  assert.equal(((await switchRes.json()) as { mode?: string }).mode, 'both')

  const reread = (await (await fetch(`${base}/api/sweep/settings`)).json()) as { mode?: string }
  assert.equal(reread.mode, 'both', '切换后 GET 应读回新模式')

  const badRes = await fetch(`${base}/api/sweep/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'disk' }),
  })
  assert.equal(badRes.status, 400, '非法 mode 应 400')
})

test('POST run 把 body.model 透传给 runner，运行中返回 409', async (t) => {
  const received: Array<string | undefined> = []
  let running = false
  const runner: SweepRunner = {
    async run(model) {
      received.push(model)
      return snapshot('2026-11-26T02:00:00.000Z')
    },
    isRunning: () => running,
  }
  const base = await startApp(t, runner)

  const runRes = await fetch(`${base}/api/sweep/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-ai/DeepSeek-V3' }),
  })
  assert.equal(runRes.status, 200, `POST run 期望 200，实际 ${runRes.status}`)
  const body = (await runRes.json()) as { snapshot?: { sweptAt?: string; status?: string } }
  assert.equal(body.snapshot?.sweptAt, '2026-11-26T02:00:00.000Z', '应返回 runner 产出的快照')
  assert.deepEqual(received, ['deepseek-ai/DeepSeek-V3'], 'runner 应收到 body 里的 model')

  running = true
  const busyRes = await fetch(`${base}/api/sweep/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(busyRes.status, 409, '巡检运行中应返回 409')
  assert.deepEqual(await busyRes.json(), { error: 'sweep running' })
  assert.equal(received.length, 1, '运行中不应再触发 runner.run')
})
