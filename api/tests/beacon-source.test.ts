import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createHackerNewsSource,
  normalizeHackerNewsItem,
} from '../src/modules/beacon/sources/hackernews.js'

// 真实结构（来自 HackerNews 官方 API 实测），测试不碰外网
const RAW_ITEM = {
  by: 'omsta',
  descendants: 0,
  id: 50638932,
  score: 42,
  time: 1795585157,
  title: 'Décor brings back fun widgets to the Mac',
  type: 'story',
  url: 'https://stgm.github.io/decor/',
}

test('normalizeHackerNewsItem：字段归一化正确', () => {
  const beacon = normalizeHackerNewsItem(RAW_ITEM)

  assert.equal(beacon.id, 'hn-50638932', `id 应带 hn- 前缀，实际 ${beacon.id}`)
  assert.equal(beacon.title, RAW_ITEM.title, '标题应取原文')
  assert.equal(beacon.url, RAW_ITEM.url, 'url 应取原文链接')
  assert.equal(beacon.source, 'hackernews', 'source 应固定 hackernews')
  assert.equal(beacon.score, 42, 'score 应取原始 score')
  assert.equal(
    Date.parse(beacon.publishedAt),
    RAW_ITEM.time * 1000,
    `publishedAt 应由 Unix 秒 *1000 转成 ISO，实际 ${beacon.publishedAt}`
  )
})

test('createHackerNewsSource：只抓前 10 条且字段齐全', async () => {
  const ids = Array.from({ length: 20 }, (_, i) => 50638800 + i)

  const fakeFetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/newstories.json')) {
      return { json: async () => ids } as unknown as Response
    }
    const matched = url.match(/item\/(\d+)\.json$/)
    const id = matched ? Number(matched[1]) : 0
    return { json: async () => ({ ...RAW_ITEM, id }) } as unknown as Response
  }) as typeof fetch

  const beacons = await createHackerNewsSource(fakeFetch).collect()

  assert.ok(beacons.length > 0, `应至少返回 1 条，实际 ${beacons.length}`)
  assert.ok(beacons.length <= 10, `最多取前 10 条，实际 ${beacons.length}`)

  const first = beacons[0]
  assert.ok(first, '首条不应为空')
  assert.ok(first.id.startsWith('hn-'), `id 应带 hn- 前缀，实际 ${first.id}`)
  assert.equal(first.source, 'hackernews', 'source 应固定 hackernews')
  assert.ok(!Number.isNaN(Date.parse(first.publishedAt)), 'publishedAt 应可被 Date.parse 解析')
})
