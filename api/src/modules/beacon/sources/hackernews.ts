import type { Beacon, BeaconSource } from '../types.js'

const HN_API = 'https://hacker-news.firebaseio.com/v0'
const MAX_ITEMS = 10

export interface HackerNewsItem {
  by?: string
  descendants?: number
  id?: number
  score?: number
  time?: number
  title?: string
  type?: string
  url?: string
}

// 归一化：HN 原始字段 → 项目统一 Beacon
export function normalizeHackerNewsItem(item: HackerNewsItem): Beacon {
  const rawId = item.id ?? 0

  return {
    id: `hn-${rawId}`,
    title: item.title ?? '',
    url: item.url ?? `https://news.ycombinator.com/item?id=${rawId}`,
    source: 'hackernews',
    score: item.score ?? 0,
    // raw.time 是 Unix 秒，不是毫秒
    publishedAt: new Date((item.time ?? 0) * 1000).toISOString(),
  }
}

// fetchFn 可注入：离线测试传假 fetch，生产走全局 fetch
export function createHackerNewsSource(fetchFn: typeof fetch = globalThis.fetch): BeaconSource {
  return {
    name: 'hackernews',
    async collect() {
      const ids = (await fetchFn(`${HN_API}/newstories.json`).then((res) => res.json())) as number[]

      const items = await Promise.all(
        ids
          .slice(0, MAX_ITEMS)
          .map((id) => fetchFn(`${HN_API}/item/${id}.json`).then((res) => res.json() as Promise<HackerNewsItem>))
      )

      return items
        .filter((item) => item?.type === 'story' && item.title)
        .map(normalizeHackerNewsItem)
    },
  }
}
