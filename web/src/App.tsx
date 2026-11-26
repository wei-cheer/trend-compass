import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

const PROBE_URL = 'http://localhost:3001/api/probe/status'
const BEACONS_URL = 'http://localhost:3001/api/beacons'
const WATCH_TERMS_URL = 'http://localhost:3001/api/watch-terms'
const BEACON_MATCH_URL = 'http://localhost:3001/api/beacon-match'
const BEACON_AUDIT_URL = 'http://localhost:3001/api/beacon-audit'

const CUSTOM_MODEL = '__custom__'
const MODEL_PRESETS = [
  { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B（免费）' },
  { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek-V3' },
  { value: 'zai-org/GLM-4.6', label: 'GLM-4.6（免费）' },
]

type ProbeState = 'loading' | 'online' | 'unreachable'

interface Beacon {
  id: string
  title: string
  url: string
  source: string
  score: number
  publishedAt: string
}

type WatchCategory = 'official' | 'other-game' | 'outside'

interface WatchTerm {
  id: string
  text: string
  category: WatchCategory
  isActive: boolean
  createdAt: string
}

interface BeaconAudit {
  beaconId: string
  matchedTerms: string[]
  isReal: boolean
  reason: string
  degraded: boolean
}

const CATEGORY_LABELS: Record<WatchCategory, string> = {
  official: '官方更新',
  'other-game': '其他游戏',
  outside: '圈外热点',
}

export default function App() {
  const [probe, setProbe] = useState<ProbeState>('loading')
  const [beacons, setBeacons] = useState<Beacon[] | null>(null)
  const [beaconsFailed, setBeaconsFailed] = useState(false)
  const [matchTags, setMatchTags] = useState<Record<string, string[]>>({})
  const [audits, setAudits] = useState<Record<string, BeaconAudit>>({})
  const [auditModel, setAuditModel] = useState('')
  const [selectedModel, setSelectedModel] = useState(MODEL_PRESETS[0].value)
  const [customModel, setCustomModel] = useState('')

  const [terms, setTerms] = useState<WatchTerm[]>([])
  const [termsFailed, setTermsFailed] = useState(false)
  const [newText, setNewText] = useState('')
  const [newCategory, setNewCategory] = useState<WatchCategory>('official')
  const [formError, setFormError] = useState('')

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

  // 审核：按选中的模型反复调用，切换模型即重审；失败静默
  async function runAudit(model?: string) {
    try {
      const res = await fetch(BEACON_AUDIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model ? { model } : {}),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { audits?: BeaconAudit[]; model?: string }
      const next: Record<string, BeaconAudit> = {}
      for (const audit of data.audits ?? []) next[audit.beaconId] = audit
      setAudits(next)
      setAuditModel(data.model ?? '')
    } catch {
      setAudits({})
    }
  }

  useEffect(() => {
    void runAudit()
  }, [])

  function handleModelChange(value: string) {
    setSelectedModel(value)
    if (value !== CUSTOM_MODEL) void runAudit(value)
  }

  async function loadTerms() {
    try {
      const res = await fetch(WATCH_TERMS_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { terms?: WatchTerm[] }
      setTerms(Array.isArray(data.terms) ? data.terms : [])
      setTermsFailed(false)
    } catch {
      setTermsFailed(true)
    }
  }

  useEffect(() => {
    void loadTerms()
  }, [])

  // 命中标记依赖后端抓取，失败时静默不显示，不影响热点列表
  useEffect(() => {
    let cancelled = false

    fetch(BEACON_MATCH_URL, { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { matches?: Array<{ beaconId: string; matchedTerms: string[] }> }) => {
        if (cancelled) return
        const next: Record<string, string[]> = {}
        for (const match of data.matches ?? []) {
          if (match.matchedTerms.length > 0) next[match.beaconId] = match.matchedTerms
        }
        setMatchTags(next)
      })
      .catch(() => {
        if (cancelled) return
        setMatchTags({})
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = newText.trim()
    if (!text) {
      setFormError('关键词不能为空')
      return
    }

    try {
      const res = await fetch(WATCH_TERMS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, category: newCategory }),
      })
      if (res.status === 409) {
        setFormError('该关键词已存在')
        return
      }
      if (!res.ok) {
        setFormError('添加失败')
        return
      }
      setNewText('')
      setFormError('')
      await loadTerms()
    } catch {
      setFormError('后端不可达')
    }
  }

  async function handleToggle(id: string) {
    await fetch(`${WATCH_TERMS_URL}/${id}/toggle`, { method: 'PATCH' })
    await loadTerms()
  }

  async function handleRemove(id: string) {
    await fetch(`${WATCH_TERMS_URL}/${id}`, { method: 'DELETE' })
    await loadTerms()
  }

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
        <div className="audit-panel">
          <label className="audit-panel__label" htmlFor="audit-model">
            审核模型
          </label>
          <select
            id="audit-model"
            className="audit-panel__select"
            value={selectedModel}
            onChange={(event) => handleModelChange(event.target.value)}
          >
            {MODEL_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
            <option value={CUSTOM_MODEL}>自定义模型 ID</option>
          </select>
          {selectedModel === CUSTOM_MODEL && (
            <>
              <input
                className="audit-panel__input"
                type="text"
                value={customModel}
                placeholder="粘贴完整模型 ID"
                onChange={(event) => setCustomModel(event.target.value)}
              />
              <button
                className="audit-panel__button"
                type="button"
                onClick={() => void runAudit(customModel.trim() || undefined)}
              >
                审核
              </button>
            </>
          )}
          {auditModel && <span className="audit-panel__current">本次模型：{auditModel}</span>}
          <p className="audit-panel__hint">完整模型名称从硅基流动模型广场复制</p>
        </div>
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
            {matchTags[beacon.id]?.length ? (
              <p className="beacon-card__tags">
                <span className="beacon-match-tag">命中：{matchTags[beacon.id].join('、')}</span>
              </p>
            ) : null}
            {audits[beacon.id] ? (
              <p
                className={`beacon-audit${audits[beacon.id].degraded ? ' beacon-audit--degraded' : ''}`}
              >
                <span className="beacon-audit__verdict">
                  {audits[beacon.id].degraded ? '未判定' : audits[beacon.id].isReal ? '真实' : '存疑'}
                </span>
                <span className="beacon-audit__reason">{audits[beacon.id].reason}</span>
                <span className="beacon-audit__model">本次模型：{auditModel}</span>
              </p>
            ) : null}
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
      <section className="watchterm-board">
        <h2 className="watchterm-board__title">关键词 · 监控清单</h2>
        <form className="watchterm-form" onSubmit={handleAdd}>
          <input
            className="watchterm-form__input"
            type="text"
            value={newText}
            placeholder="输入要盯的关键词"
            onChange={(event) => setNewText(event.target.value)}
          />
          <select
            className="watchterm-form__select"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value as WatchCategory)}
          >
            <option value="official">官方更新</option>
            <option value="other-game">其他游戏</option>
            <option value="outside">圈外热点</option>
          </select>
          <button className="watchterm-form__submit" type="submit">
            添加
          </button>
        </form>
        {formError && <p className="watchterm-board__error">{formError}</p>}
        {termsFailed && <p className="beacon-board__hint">关键词拉取失败</p>}
        {!termsFailed && terms.length === 0 && (
          <p className="beacon-board__hint">暂无关键词，先添加一个吧</p>
        )}
        {terms.map((term) => (
          <article key={term.id} className={`watchterm-item${term.isActive ? '' : ' watchterm-item--off'}`}>
            <div className="watchterm-item__main">
              <span className="watchterm-item__text">{term.text}</span>
              <span className="watchterm-item__category">{CATEGORY_LABELS[term.category]}</span>
            </div>
            <div className="watchterm-item__actions">
              <button
                className="watchterm-item__toggle"
                type="button"
                onClick={() => void handleToggle(term.id)}
              >
                {term.isActive ? '停用' : '启用'}
              </button>
              <button
                className="watchterm-item__remove"
                type="button"
                onClick={() => void handleRemove(term.id)}
              >
                删除
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
