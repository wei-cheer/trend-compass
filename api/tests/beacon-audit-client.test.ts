import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuditClient } from '../src/modules/beaconaudit/client.js'

test('正常判定：解析 AI JSON，且传入的 model 真的进入请求体（动态切换生效）', async () => {
  const bodies: Array<Record<string, unknown>> = []
  const fakeFetch = (async (_url: string, init?: { body?: string }) => {
    bodies.push(JSON.parse(init?.body ?? '{}') as Record<string, unknown>)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"isReal":true,"reason":"与关键词 AI 直接相关"}' } }],
      }),
    } as unknown as Response
  }) as unknown as typeof fetch

  const client = createAuditClient({
    fetchFn: fakeFetch,
    getConfig: () => ({ apiKey: 'test-key', baseUrl: 'https://fake', model: 'fake-model' }),
  })

  const result = await client.audit('OpenAI ships a new AI model', ['AI'], 'custom-model-x')
  assert.equal(result.isReal, true, '应解析出 isReal')
  assert.equal(result.reason, '与关键词 AI 直接相关', '应解析出理由')
  assert.equal(result.degraded, false, '正常调用不应降级')
  assert.equal(bodies[0]?.model, 'custom-model-x', '请求体 model 应为传入值')

  await client.audit('Another title', ['AI'])
  assert.equal(bodies[1]?.model, 'fake-model', '未传 model 时请求体应使用配置值')
})

test('降级：401、fetch 抛错、无 key 都返回 degraded 且不抛异常', async () => {
  const unauthorized = createAuditClient({
    fetchFn: (async () => ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch,
    getConfig: () => ({ apiKey: 'bad-key', baseUrl: 'https://fake', model: 'fake-model' }),
  })
  const result401 = await unauthorized.audit('t', ['AI'])
  assert.equal(result401.degraded, true, '401 应降级')
  assert.equal(result401.isReal, false, '降级时 isReal 应为 false')
  assert.ok(result401.reason.length > 0, '降级理由不应为空')

  const throwing = createAuditClient({
    fetchFn: (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch,
    getConfig: () => ({ apiKey: 'test-key', baseUrl: 'https://fake', model: 'fake-model' }),
  })
  const resultThrow = await throwing.audit('t', ['AI'])
  assert.equal(resultThrow.degraded, true, 'fetch 抛错应降级')

  let called = 0
  const noKey = createAuditClient({
    fetchFn: (async () => {
      called += 1
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response
    }) as unknown as typeof fetch,
    getConfig: () => ({ apiKey: '', baseUrl: 'https://fake', model: 'fake-model' }),
  })
  const resultNoKey = await noKey.audit('t', ['AI'])
  assert.equal(resultNoKey.degraded, true, '没配 key 应降级')
  assert.equal(called, 0, '没配 key 时不应发请求')
})
