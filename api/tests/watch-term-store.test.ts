import test from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWatchTermStore, DUPLICATE_CODE } from '../src/modules/watchterm/store.js'

// 每个用例独立临时目录，全程不碰 api/data 真实文件
function tempFilePath(t: TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'watchterm-store-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return join(dir, 'watch-terms.json')
}

test('空库初始化、add 写入、list 按 createdAt 倒序', (t) => {
  const store = createWatchTermStore(tempFilePath(t))

  assert.deepEqual(store.list(), [], '新库应为空数组')

  const first = store.add('率土之滨', 'official')
  assert.equal(first.text, '率土之滨', '应原样保存 text')
  assert.equal(first.category, 'official', '应保存 category')
  assert.equal(first.isActive, true, '新增默认启用')
  assert.ok(first.id.length > 0, 'id 应为非空 UUID')
  assert.ok(!Number.isNaN(Date.parse(first.createdAt)), 'createdAt 应为可解析的 ISO 时间')

  const second = store.add('原神', 'other-game')
  assert.deepEqual(
    store.list().map((term) => term.id),
    [second.id, first.id],
    '最新添加的应排在最前'
  )
})

test('重复文本抛 DUPLICATE、remove / toggle 语义', (t) => {
  const store = createWatchTermStore(tempFilePath(t))
  const term = store.add('率土之滨', 'official')

  assert.throws(
    () => store.add(' 率土之滨 ', 'official'),
    (error: unknown) => (error as { code?: string }).code === DUPLICATE_CODE,
    'trim 后重复应抛 DUPLICATE'
  )

  assert.equal(store.remove('not-exist'), false, '删除不存在的 id 应返回 false')

  const toggled = store.toggle(term.id)
  assert.equal(toggled?.isActive, false, 'toggle 应把启用翻转为停用')
  assert.equal(store.toggle('not-exist'), null, 'toggle 不存在的 id 应返回 null')

  assert.equal(store.remove(term.id), true, '删除存在的 id 应返回 true')
  assert.deepEqual(store.list(), [], '删除后列表应为空')
})

test('坏文件兜底：返回空数组、不改原文件、写入时重建结构', (t) => {
  const filePath = tempFilePath(t)
  writeFileSync(filePath, '{ not json', 'utf8')

  const store = createWatchTermStore(filePath)
  assert.deepEqual(store.list(), [], '坏文件应兜底为空数组')
  assert.equal(readFileSync(filePath, 'utf8'), '{ not json', '坏文件不应被删除或改写')

  const term = store.add('率土之滨', 'outside')
  assert.equal(term.text, '率土之滨', '重建后应能正常写入')

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { version?: number; terms?: unknown[] }
  assert.equal(parsed.version, 1, '重建后文件应为 version 1')
  assert.equal(parsed.terms?.length, 1, '重建后应包含刚添加的词')
})
