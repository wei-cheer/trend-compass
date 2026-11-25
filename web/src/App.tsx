import { useEffect, useState } from 'react'

const PROBE_URL = 'http://localhost:3001/api/probe/status'
const BEACONS_URL = 'http://localhost:3001/api/beacons'

type ProbeState = 'loading' | 'online' | 'unreachable'

interface Beacon {
  id: string
  title: string
  url: string
  source: string
  score: number
  publishedAt: string
}

export default function App() {
  const [probe, setProbe] = useState<ProbeState>('loading')
  const [beacons, setBeacons] = useState<Beacon[] | null>(null)
  const [beaconsFailed, setBeaconsFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch(PROBE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { state?: string }) => {
        if (cancelled) return
        setProbe(data.state === 'online' ? 'online' : 'unreachable')
      })
      .catch(() => {
        if (cancelled) return
        setProbe('unreachable')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch(BEACONS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { beacons?: Beacon[] }) => {
        if (cancelled) return
        setBeacons(Array.isArray(data.beacons) ? data.beacons : [])
      })
      .catch(() => {
        if (cancelled) return
        setBeaconsFailed(true)
        setBeacons([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="compass">
      <header className="compass__header">
        <h1 className="compass__title">热点罗盘</h1>
        <p className="compass__subtitle">多源热点聚合 · 作战沙盘</p>
      </header>
      <section className={`probe-card probe-card--${probe}`}>
        <span className="probe-card__dot" aria-hidden="true" />
        <p>
          {probe === 'loading' && '探针状态：加载中'}
          {probe === 'online' && '探针状态：online'}
          {probe === 'unreachable' && '探针不可达'}
        </p>
      </section>
      <section className="beacon-board">
        <h2 className="beacon-board__title">烽火 · 热点列表</h2>
        {beacons === null && <p className="beacon-board__hint">热点加载中…</p>}
        {beacons !== null && beaconsFailed && <p className="beacon-board__hint">热点拉取失败</p>}
        {beacons !== null && !beaconsFailed && beacons.length === 0 && (
          <p className="beacon-board__hint">暂无热点</p>
        )}
        {beacons?.map((beacon) => (
          <article key={beacon.id} className="beacon-card">
            <a className="beacon-card__title" href={beacon.url} target="_blank" rel="noreferrer">
              {beacon.title}
            </a>
            <p className="beacon-card__meta">
              <span className="beacon-card__source">{beacon.source}</span>
              <span className="beacon-card__score">热度 {beacon.score}</span>
              <time className="beacon-card__time" dateTime={beacon.publishedAt}>
                {new Date(beacon.publishedAt).toLocaleString('zh-CN')}
              </time>
            </p>
          </article>
        ))}
      </section>
    </main>
  )
}
