import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { beaconRouter } from '../src/modules/beacon/router.js'
import { beaconSources } from '../src/modules/beacon/registry.js'
import type { BeaconSource } from '../src/modules/beacon/types.js'

test('GET /api/beacons：返回 beacons 数组与可解析的 fetchedAt', async (t) => {
  // 注入假 source，保证全程离线（各测试文件独立进程，不影响其它用例）
  const fakeSource: BeaconSource = {
    name: 'fake',
    async collect() {
      return [
        {
          id: 'fake-1',
          title: '假热点',
          url: 'https://example.com/1',
          source: 'fake',
          score: 9,
          publishedAt: new Date('2026-11-25T00:00:00.000Z').toISOString(),
        },
      ]
    },
  }
  beaconSources.length = 0
  beaconSources.push(fakeSource)

  const app = express()
  app.use('/api/beacons', beaconRouter)

  const server = app.listen(0)
  t.after(() => server.close())
  await new Promise((resolve) => server.once('listening', resolve))

  const { port } = server.address() as AddressInfo
  const res = await fetch(`http://127.0.0.1:${port}/api/beacons`)

  assert.equal(res.status, 200, `期望 200，实际 ${res.status}`)

  const body = (await res.json()) as { beacons?: unknown; fetchedAt?: unknown }
  assert.ok(Array.isArray(body.beacons), `beacons 应为数组，实际 ${JSON.stringify(body.beacons)}`)
  assert.ok(
    typeof body.fetchedAt === 'string' && !Number.isNaN(Date.parse(body.fetchedAt)),
    `fetchedAt 应可被 Date.parse 解析，实际 ${String(body.fetchedAt)}`
  )
})
