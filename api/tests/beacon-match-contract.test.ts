import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { beaconMatchRouter } from '../src/modules/beaconmatch/router.js'
import { beaconSources } from '../src/modules/beacon/registry.js'
import { createWatchTermStore, setWatchTermStore } from '../src/modules/watchterm/store.js'
import type { Beacon } from '../src/modules/beacon/types.js'

test('POST /api/beacon-match：返回 matches 结构、命中词与可解析 fetchedAt', async (t) => {
  // 假热点源注入（Step 6 手法）
  const fakeBeacons: Beacon[] = [
    {
      id: 'hn-ai',
      title: 'OpenAI ships a new AI model',
      url: 'https://example.com/ai',
      source: 'fake',
      score: 10,
      publishedAt: '2026-11-25T00:00:00.000Z',
    },
    {
      id: 'hn-other',
      title: 'A story about cooking',
      url: 'https://example.com/other',
      source: 'fake',
      score: 5,
      publishedAt: '2026-11-25T00:00:00.000Z',
    },
  ]
  beaconSources.length = 0
  beaconSources.push({ name: 'fake', async collect() { return fakeBeacons } })

  // 临时 store 注入（Step 7 手法）
  const dir = mkdtempSync(join(tmpdir(), 'beacon-match-contract-'))
  const store = createWatchTermStore(join(dir, 'watch-terms.json'))
  store.add('AI', 'outside')
  store.add('Rust', 'outside')
  setWatchTermStore(store)

  const app = express()
  app.use(express.json())
  app.use('/api/beacon-match', beaconMatchRouter)

  const server = app.listen(0)
  t.after(() => {
    server.close()
    rmSync(dir, { recursive: true, force: true })
  })
  await new Promise((resolve) => server.once('listening', resolve))

  const { port } = server.address() as AddressInfo
  const res = await fetch(`http://127.0.0.1:${port}/api/beacon-match`, { method: 'POST' })

  assert.equal(res.status, 200, `期望 200，实际 ${res.status}`)

  const body = (await res.json()) as { matches?: Array<{ beaconId: string; matchedTerms: string[] }>; fetchedAt?: unknown }
  assert.ok(Array.isArray(body.matches), 'matches 应为数组')

  const aiMatch = body.matches.find((match) => match.beaconId === 'hn-ai')
  const otherMatch = body.matches.find((match) => match.beaconId === 'hn-other')
  assert.deepEqual(aiMatch?.matchedTerms, ['AI'], 'hn-ai 应命中 AI')
  assert.deepEqual(otherMatch?.matchedTerms, [], '未命中热点也要返回空数组')
  assert.ok(
    typeof body.fetchedAt === 'string' && !Number.isNaN(Date.parse(body.fetchedAt)),
    `fetchedAt 应可被 Date.parse 解析，实际 ${String(body.fetchedAt)}`
  )
})
