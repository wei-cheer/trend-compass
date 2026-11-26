import { createAuditClient } from './client.js'
import type { AuditClient } from './client.js'
import type { BeaconAudit } from './types.js'

// 与 watchterm/store.ts 同构：可替换实例 + 内存缓存最近一次审核结果
export let activeAuditClient: AuditClient = createAuditClient()

export function setAuditClient(client: AuditClient): void {
  activeAuditClient = client
}

export let latestAudits: BeaconAudit[] = []

export function setLatestAudits(audits: BeaconAudit[]): void {
  latestAudits = audits
}
