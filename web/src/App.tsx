import { useEffect, useState } from 'react'

const PROBE_URL = 'http://localhost:3001/api/probe/status'

type ProbeState = 'loading' | 'online' | 'unreachable'

export default function App() {
  const [probe, setProbe] = useState<ProbeState>('loading')

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
    </main>
  )
}
