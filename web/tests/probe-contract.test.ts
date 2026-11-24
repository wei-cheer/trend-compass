import test from 'node:test'
import assert from 'node:assert/strict'

// 跨端契约测试：要求跑测前后端 3001 已启动
const PROBE_URL = 'http://localhost:3001/api/probe/status'
const WEB_ORIGIN = 'http://localhost:5173'

test('探针接口数据契约：200、state 为 online、无 status 字段', async () => {
  const res = await fetch(PROBE_URL)
  assert.equal(res.status, 200, '探针接口应返回 200')

  const body = (await res.json()) as Record<string, unknown>
  assert.equal(body.state, 'online', '返回体的 state 应为 online')
  assert.ok(!('status' in body), '返回体不应包含 status 字段（字段名是 state）')
})

test('跨域契约：放行来源 http://localhost:5173', async () => {
  const res = await fetch(PROBE_URL, { headers: { Origin: WEB_ORIGIN } })
  assert.equal(
    res.headers.get('access-control-allow-origin'),
    WEB_ORIGIN,
    '后端应返回 Access-Control-Allow-Origin: http://localhost:5173，否则浏览器会拦截'
  )
})
