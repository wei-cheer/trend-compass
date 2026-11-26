import { Router } from 'express'
import { collectBeacons } from '../beacon/registry.js'
import { matchBeacons } from '../beaconmatch/matcher.js'
import { activeStore } from '../watchterm/store.js'
import { activeAuditClient, setLatestAudits } from './store.js'
import { resolveAuditModel } from './prompt.js'
import type { BeaconAudit } from './types.js'

const MAX_AUDITS = 5
const DEGRADED_REASON = 'AI 未配置或调用失败'

export const beaconAuditRouter = Router()

beaconAuditRouter.post('/', async (req, res) => {
  const body = req.body as { model?: unknown } | undefined
  const requestedModel = typeof body?.model === 'string' ? body.model : undefined
  const model = resolveAuditModel(requestedModel, process.env.AI_MODEL)
  const fetchedAt = new Date().toISOString()

  let audits: BeaconAudit[] = []

  try {
    const beacons = await collectBeacons()
    const matches = matchBeacons(beacons, activeStore.list())
      .filter((match) => match.matchedTerms.length > 0)
      .slice(0, MAX_AUDITS)
    const beaconById = new Map(beacons.map((beacon) => [beacon.id, beacon]))

    // 逐条审核，单条失败不影响其余（不做并发）
    for (const match of matches) {
      const beacon = beaconById.get(match.beaconId)
      if (!beacon) continue

      try {
        const result = await activeAuditClient.audit(beacon.title, match.matchedTerms, requestedModel)
        audits.push({
          beaconId: beacon.id,
          matchedTerms: match.matchedTerms,
          isReal: result.isReal,
          reason: result.reason,
          degraded: result.degraded,
        })
      } catch {
        audits.push({
          beaconId: beacon.id,
          matchedTerms: match.matchedTerms,
          isReal: false,
          reason: DEGRADED_REASON,
          degraded: true,
        })
      }
    }
  } catch {
    // 抓热点失败：不 5xx，空审核结果 + 仍回传 model / fetchedAt
    audits = []
  }

  setLatestAudits(audits)
  res.json({ audits, model, fetchedAt })
})
