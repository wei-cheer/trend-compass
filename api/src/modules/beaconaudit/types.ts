export interface BeaconAudit {
  beaconId: string
  matchedTerms: string[]
  isReal: boolean
  reason: string
  degraded: boolean
}
