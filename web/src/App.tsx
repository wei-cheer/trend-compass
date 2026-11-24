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
    <main>
      <h1>热点罗盘</h1>
      <p>
        {probe === 'loading' && '探针状态：加载中'}
        {probe === 'online' && '探针状态：online'}
        {probe === 'unreachable' && '探针不可达'}
      </p>
    </main>
  )
}
