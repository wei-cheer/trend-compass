import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { beaconAuditRouter } from '../src/modules/beaconaudit/router.js'
import { setAuditClient } from '../src/modules/beaconaudit/store.js'
import type { AuditClient } from '../src/modules/beaconaudit/client.js'
import { beaconSources } from '../src/modules/beacon/registry.js'
import { createWatchTermStore, setWatchTermStore } from '../src/modules/watchterm/store.js'
import type { Beacon } from '../src/modules/beacon/types.js'

test('POST /api/beacon-audit：只审命中词的热点、回传实际模型、结构正确', async (t) => {
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
      id: 'hn-cook',
      title: 'A story about cooking',
      url: 'https://example.com/cook',
      source: 'fake',
      score: 5,
      publishedAt: '2026-11-25T00:00:00.000Z',
    },
  ]
  beaconSources.length = 0
  beaconSources.push({ name: 'fake', async collect() { return fakeBeacons } })

  const dir = mkdtempSync(join(tmpdir(), 'beacon-audit-contract-'))
  const store = createWatchTermStore(join(dir, 'watch-terms.json'))
  store.add('AI', 'outside')
  setWatchTermStore(store)

  const auditCalls: Array<{ title: string; matchedTerms: string[]; model?: string }> = []
  const fakeClient: AuditClient = {
    async audit(title, matchedTerms, model) {
      auditCalls.push({ title, matchedTerms, model })
      return { isReal: true, reason: '与关键词 AI 直接相关', degraded: false }
    },
  }
  setAuditClient(fakeClient)

  const app = express()
  app.use(express.json())
  app.use('/api/beacon-audit', beaconAuditRouter)

  const server = app.listen(0)
  t.after(() => {
    server.close()
    rmSync(dir, { recursive: true, force: true })
  })
  await new Promise((resolve) => server.once('listening', resolve))

  const { port } = server.address() as AddressInfo
  const res = await fetch(`http://127.0.0.1:${port}/api/beacon-audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-ai/DeepSeek-V3' }),
  })

  assert.equal(res.status, 200, `期望 200，实际 ${res.status}`)

  const body = (await res.json()) as {
    audits?: Array<{ beaconId: string; matchedTerms: string[]; isReal: boolean; reason: string; degraded: boolean }>
    model?: string
    fetchedAt?: unknown
  }

  assert.equal(body.model, 'deepseek-ai/DeepSeek-V3', '顶层应回传本次实际使用的模型')
  assert.ok(Array.isArray(body.audits), 'audits 应为数组')
  assert.equal(body.audits?.length, 1, '只应审命中的那一条热点')
  assert.equal(body.audits?.[0]?.beaconId, 'hn-ai', '审核对象应为命中词的热点')
  assert.deepEqual(body.audits?.[0]?.matchedTerms, ['AI'], 'matchedTerms 应带命中词')
  assert.equal(body.audits?.[0]?.isReal, true, 'isReal 应透传 AI 判定')
  assert.equal(body.audits?.[0]?.degraded, false, '正常路径不应降级')
  assert.equal(auditCalls.length, 1, '未命中的热点不应触发 AI 调用')
  assert.equal(auditCalls[0]?.model, 'deepseek-ai/DeepSeek-V3', 'client 应收到请求体里的模型')
  assert.ok(
    typeof body.fetchedAt === 'string' && !Number.isNaN(Date.parse(body.fetchedAt)),
    `fetchedAt 应可被 Date.parse 解析，实际 ${String(body.fetchedAt)}`
  )
})
