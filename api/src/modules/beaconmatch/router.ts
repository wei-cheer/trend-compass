import { Router } from 'express'
import { collectBeacons } from '../beacon/registry.js'
import { activeStore } from '../watchterm/store.js'
import { matchBeacons } from './matcher.js'

export const beaconMatchRouter = Router()

beaconMatchRouter.post('/', async (_req, res) => {
  const beacons = await collectBeacons()
  const matches = matchBeacons(beacons, activeStore.list())
  res.json({ matches, fetchedAt: new Date().toISOString() })
})
