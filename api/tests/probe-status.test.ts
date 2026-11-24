import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import app from '../src/main.ts'

// 用随机端口起实例，避免和 dev 的 3001 冲突；测试结束关闭 server
test('GET /api/probe/status 返回 online 与 ISO 时间', async (t) => {
  const server = app.listen(0)
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  t.after(() => server.close())

  const { port } = server.address() as AddressInfo
  const res = await fetch(`http://127.0.0.1:${port}/api/probe/status`)

  assert.equal(res.status, 200, 'HTTP 状态码应为 200')

  const body = (await res.json()) as Record<string, unknown>
  assert.equal(body.state, 'online', '字段 state 的值应为 online')
  assert.equal(typeof body.checkedAt, 'string', 'checkedAt 应为字符串')
  assert.ok(
    !Number.isNaN(Date.parse(body.checkedAt as string)),
    'checkedAt 应能被 Date.parse 解析成合法时间'
  )
  assert.ok(!('status' in body), '外层对象不应出现 status 字段（字段名是 state）')
})
