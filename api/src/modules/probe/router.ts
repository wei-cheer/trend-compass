import { Router } from 'express'

const probeRouter = Router()

probeRouter.get('/status', (_req, res) => {
  res.json({ state: 'online', checkedAt: new Date().toISOString() })
})

export default probeRouter
