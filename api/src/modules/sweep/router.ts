import { Router } from 'express'
import {
  activeFileStore,
  activeMemoryStore,
  activeSweepRunner,
  getSweepMode,
  setSweepMode,
} from './store.js'
import { resolveSweepIntervalMs } from './runner.js'
import type { SweepMode, SweepSnapshot } from './types.js'

const VALID_MODES: SweepMode[] = ['memory', 'file', 'both']

export const sweepRouter = Router()

sweepRouter.get('/latest', (_req, res) => {
  const mode = getSweepMode()
  const memoryLatest = activeMemoryStore.getLatest()
  const fileHistory = activeFileStore.list()

  // 切换不迁移数据：看到的是当前模式对应的那一份
  let latest: SweepSnapshot | null = null
  let history: SweepSnapshot[] = []

  if (mode === 'memory') {
    latest = memoryLatest
  } else if (mode === 'file') {
    latest = fileHistory[fileHistory.length - 1] ?? null
    history = fileHistory
  } else {
    latest = memoryLatest
    history = fileHistory
  }

  res.json({ mode, latest, history })
})

sweepRouter.get('/settings', (_req, res) => {
  res.json({ mode: getSweepMode(), intervalMs: resolveSweepIntervalMs() })
})

sweepRouter.post('/settings', (req, res) => {
  const mode = (req.body as { mode?: unknown } | undefined)?.mode
  if (typeof mode !== 'string' || !VALID_MODES.includes(mode as SweepMode)) {
    res.status(400).json({ error: 'invalid mode' })
    return
  }

  setSweepMode(mode as SweepMode)
  res.json({ mode: getSweepMode() })
})

sweepRouter.post('/run', async (req, res) => {
  const runner = activeSweepRunner
  if (!runner) {
    res.status(500).json({ error: 'sweep runner not ready' })
    return
  }

  if (runner.isRunning()) {
    res.status(409).json({ error: 'sweep running' })
    return
  }

  const model = (req.body as { model?: unknown } | undefined)?.model
  const snapshot = await runner.run(typeof model === 'string' ? model : undefined)
  res.json({ snapshot })
})
