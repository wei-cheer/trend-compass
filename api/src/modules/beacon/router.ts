import { Router } from 'express'
import { collectBeacons } from './registry.js'

export const beaconRouter = Router()

beaconRouter.get('/', async (_req, res) => {
  const beacons = await collectBeacons()
  res.json({ beacons, fetchedAt: new Date().toISOString() })
})
