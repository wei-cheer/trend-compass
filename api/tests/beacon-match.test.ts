import test from 'node:test'
import assert from 'node:assert/strict'
import { matchBeacons } from '../src/modules/beaconmatch/matcher.js'
import type { Beacon } from '../src/modules/beacon/types.js'
import type { WatchTerm } from '../src/modules/watchterm/types.js'

function beacon(id: string, title: string): Beacon {
  return {
    id,
    title,
    url: `https://example.com/${id}`,
    source: 'fake',
    score: 1,
    publishedAt: '2026-11-25T00:00:00.000Z',
  }
}

function term(id: string, text: string, isActive = true): WatchTerm {
  return {
    id,
    text,
    category: 'outside',
    isActive,
    createdAt: '2026-11-25T00:00:00.000Z',
  }
}

test('大小写不敏感、一词多命中、停用词不参与', () => {
  const beacons = [
    beacon('hn-1', 'Claude and AI agents reshape dev tools'),
    beacon('hn-2', 'Rust in production at scale'),
  ]
  const terms = [term('t1', 'AI'), term('t2', 'claude'), term('t3', 'Rust', false)]

  assert.deepEqual(
    matchBeacons(beacons, terms),
    [
      { beaconId: 'hn-1', matchedTerms: ['AI', 'claude'] },
      { beaconId: 'hn-2', matchedTerms: [] },
    ],
    '应大小写不敏感命中、保留原文、停用词 Rust 不参与'
  )
})

test('中文词对中文标题也能命中、无命中条目保留空数组', () => {
  const beacons = [beacon('hn-9', '率土之滨 新赛季开服'), beacon('hn-10', 'Completely unrelated news')]
  const terms = [term('t9', '率土之滨')]

  assert.deepEqual(
    matchBeacons(beacons, terms),
    [
      { beaconId: 'hn-9', matchedTerms: ['率土之滨'] },
      { beaconId: 'hn-10', matchedTerms: [] },
    ],
    '中文子串应能命中，未命中热点也要保留条目'
  )
})
