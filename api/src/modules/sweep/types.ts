import type { Beacon } from '../beacon/types.js'
import type { BeaconAudit } from '../beaconaudit/types.js'

export type SweepMode = 'memory' | 'file' | 'both'

export interface SweepMatch {
  beaconId: string
  matchedTerms: string[]
}

export interface SweepSnapshot {
  sweptAt: string
  beacons: Beacon[]
  matches: SweepMatch[]
  audits: BeaconAudit[]
  model: string
  status: 'ok' | 'degraded'
}

export interface SweepRunner {
  run(model?: string): Promise<SweepSnapshot>
  isRunning(): boolean
}

export interface MemorySweepStore {
  setLatest(snapshot: SweepSnapshot): void
  getLatest(): SweepSnapshot | null
}

export interface FileSweepStore {
  append(snapshot: SweepSnapshot): void
  list(): SweepSnapshot[]
}
