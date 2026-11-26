import express from 'express'
import dotenv from 'dotenv'
import { pathToFileURL } from 'node:url'
import probeRouter from './modules/probe/router.js'
import { beaconRouter } from './modules/beacon/router.js'
import { watchTermRouter } from './modules/watchterm/router.js'
import { beaconMatchRouter } from './modules/beaconmatch/router.js'
import { beaconAuditRouter } from './modules/beaconaudit/router.js'
import { sweepRouter } from './modules/sweep/router.js'
import { createSweepRunner, resolveSweepIntervalMs, startSweepScheduler } from './modules/sweep/runner.js'
import {
  activeFileStore,
  activeMemoryStore,
  getSweepMode,
  setSweepRunner,
} from './modules/sweep/store.js'
import { collectBeacons } from './modules/beacon/registry.js'
import { matchBeacons } from './modules/beaconmatch/matcher.js'
import { activeStore } from './modules/watchterm/store.js'
import { activeAuditClient } from './modules/beaconaudit/store.js'
import { resolveAuditModel } from './modules/beaconaudit/prompt.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

// 放行前端 dev server；零依赖手写，未引入 cors 包
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }
  next()
})

app.use(express.json())

app.use('/api/probe', probeRouter)
app.use('/api/beacons', beaconRouter)
app.use('/api/watch-terms', watchTermRouter)
app.use('/api/beacon-match', beaconMatchRouter)
app.use('/api/beacon-audit', beaconAuditRouter)
app.use('/api/sweep', sweepRouter)

// 直接运行（tsx watch 等）时才监听 + 启动巡检；被测试 import 时不占端口、不联网
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sweepRunner = createSweepRunner({
    collectBeacons,
    matchBeacons,
    audit: (title, terms, model) => activeAuditClient.audit(title, terms, model),
    listTerms: () => activeStore.list(),
    resolveModel: (requested) => resolveAuditModel(requested, process.env.AI_MODEL),
    getMode: getSweepMode,
    memoryStore: activeMemoryStore,
    fileStore: activeFileStore,
  })
  setSweepRunner(sweepRunner)

  app.listen(port, () => {
    console.log(`trend-compass api listening on ${port}`)
  })

  // 启动即跑一次（不 await，失败不阻塞启动）
  void sweepRunner.run()
  startSweepScheduler({ run: (model) => sweepRunner.run(model), intervalMs: resolveSweepIntervalMs() })
}

export default app
