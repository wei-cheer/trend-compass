import test from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { watchTermRouter } from '../src/modules/watchterm/router.js'
import { createWatchTermStore, setWatchTermStore } from '../src/modules/watchterm/store.js'
import type { WatchTerm } from '../src/modules/watchterm/types.js'

// 注入临时 store + 随机端口，全程离线
async function startApp(t: TestContext): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'watchterm-contract-'))
  setWatchTermStore(createWatchTermStore(join(dir, 'watch-terms.json')))

  const app = express()
  app.use(express.json())
  app.use('/api/watch-terms', watchTermRouter)

  const server = app.listen(0)
  t.after(() => {
    server.close()
    rmSync(dir, { recursive: true, force: true })
  })
  await new Promise((resolve) => server.once('listening', resolve))

  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}`
}

function postTerm(base: string, body: unknown) {
  return fetch(`${base}/api/watch-terms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('GET / POST / DELETE：主链路与重复 409', async (t) => {
  const base = await startApp(t)

  const empty = await fetch(`${base}/api/watch-terms`)
  assert.equal(empty.status, 200, `GET 期望 200，实际 ${empty.status}`)
  const emptyBody = (await empty.json()) as { terms?: unknown }
  assert.ok(Array.isArray(emptyBody.terms), 'GET 应返回 terms 数组')

  const created = await postTerm(base, { text: '率土之滨', category: 'official' })
  assert.equal(created.status, 201, `POST 期望 201，实际 ${created.status}`)
  const createdBody = (await created.json()) as { term?: WatchTerm }
  const term = createdBody.term
  assert.ok(term, 'POST 应返回 term')
  assert.equal(term?.text, '率土之滨', 'term.text 应等于提交值')
  assert.equal(term?.isActive, true, '新增默认启用')
  assert.ok((term?.id ?? '').length > 0, 'term.id 应为非空 UUID')
  assert.ok(!Number.isNaN(Date.parse(term?.createdAt ?? '')), 'createdAt 应为可解析时间')

  const duplicate = await postTerm(base, { text: ' 率土之滨 ', category: 'other-game' })
  assert.equal(duplicate.status, 409, `重复 POST 期望 409，实际 ${duplicate.status}`)

  const removed = await fetch(`${base}/api/watch-terms/${term?.id}`, { method: 'DELETE' })
  assert.equal(removed.status, 204, `DELETE 期望 204，实际 ${removed.status}`)
  assert.equal(await removed.text(), '', '204 不应有响应体')

  const removedAgain = await fetch(`${base}/api/watch-terms/${term?.id}`, { method: 'DELETE' })
  assert.equal(removedAgain.status, 404, `重复 DELETE 期望 404，实际 ${removedAgain.status}`)
})

test('PATCH toggle 与参数校验', async (t) => {
  const base = await startApp(t)

  const created = await postTerm(base, { text: '原神', category: 'other-game' })
  assert.equal(created.status, 201, `POST 期望 201，实际 ${created.status}`)

  const { term } = (await created.json()) as { term: WatchTerm }

  const toggled = await fetch(`${base}/api/watch-terms/${term.id}/toggle`, { method: 'PATCH' })
  assert.equal(toggled.status, 200, `PATCH 期望 200，实际 ${toggled.status}`)
  const toggledBody = (await toggled.json()) as { term?: WatchTerm }
  assert.equal(toggledBody.term?.isActive, false, 'toggle 后应变为停用')

  const toggleMissing = await fetch(`${base}/api/watch-terms/not-exist/toggle`, { method: 'PATCH' })
  assert.equal(toggleMissing.status, 404, `PATCH 不存在 id 期望 404，实际 ${toggleMissing.status}`)

  const emptyText = await postTerm(base, { text: '   ', category: 'official' })
  assert.equal(emptyText.status, 400, `空文本期望 400，实际 ${emptyText.status}`)

  const badCategory = await postTerm(base, { text: '测试词', category: 'unknown' })
  assert.equal(badCategory.status, 400, `非法分类期望 400，实际 ${badCategory.status}`)
})
