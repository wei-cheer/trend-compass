import type { Beacon } from '../beacon/types.js'
import type { BeaconAudit } from '../beaconaudit/types.js'
import type { WatchTerm } from '../watchterm/types.js'
import type { FileSweepStore, MemorySweepStore, SweepMatch, SweepMode, SweepRunner, SweepSnapshot } from './types.js'

const MAX_AUDITS = 5
const DEFAULT_INTERVAL_MS = 1_800_000
const DEGRADED_REASON = 'AI 未配置或调用失败'

export function resolveSweepIntervalMs(raw: string | undefined = process.env.SWEEP_INTERVAL_MS): number {
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS
}

// 依赖全注入，测试可完全离线
export function createSweepRunner(options: {
  collectBeacons: () => Promise<Beacon[]>
  matchBeacons: (beacons: Beacon[], terms: WatchTerm[]) => SweepMatch[]
  audit: (
    title: string,
    terms: string[],
    model?: string
  ) => Promise<{ isReal: boolean; reason: string; degraded: boolean }>
  listTerms: () => WatchTerm[]
  resolveModel: (requested: string | undefined) => string
  getMode: () => SweepMode
  memoryStore: MemorySweepStore
  fileStore: FileSweepStore
}): SweepRunner {
  let running = false
  let lastSnapshot: SweepSnapshot | null = null

  async function run(requestedModel?: string): Promise<SweepSnapshot> {
    // 防重叠：定时器 tick 与手动触发共用，运行中直接返回上一份
    if (running) {
      return (
        lastSnapshot ?? {
          sweptAt: new Date().toISOString(),
          beacons: [],
          matches: [],
          audits: [],
          model: options.resolveModel(requestedModel),
          status: 'degraded',
        }
      )
    }

    running = true

    try {
      const mode = options.getMode()
      const model = options.resolveModel(requestedModel)
      let status: SweepSnapshot['status'] = 'ok'

      let beacons: Beacon[] = []
      try {
        beacons = await options.collectBeacons()
      } catch {
        // 抓取整体失败：空快照 + degraded，不抛给调用方
        status = 'degraded'
      }

      let matches: SweepMatch[] = []
      const audits: BeaconAudit[] = []

      if (beacons.length > 0) {
        matches = options.matchBeacons(beacons, options.listTerms())
        const beaconById = new Map(beacons.map((beacon) => [beacon.id, beacon]))
        const matched = matches.filter((match) => match.matchedTerms.length > 0).slice(0, MAX_AUDITS)

        // 逐条审核，一条失败不影响其余（不做并发）
        for (const match of matched) {
          const beacon = beaconById.get(match.beaconId)
          if (!beacon) continue

          try {
            const result = await options.audit(beacon.title, match.matchedTerms, model)
            audits.push({
              beaconId: beacon.id,
              matchedTerms: match.matchedTerms,
              isReal: result.isReal,
              reason: result.reason,
              degraded: result.degraded,
            })
            if (result.degraded) status = 'degraded'
          } catch {
            audits.push({
              beaconId: beacon.id,
              matchedTerms: match.matchedTerms,
              isReal: false,
              reason: DEGRADED_REASON,
              degraded: true,
            })
            status = 'degraded'
          }
        }
      }

      const snapshot: SweepSnapshot = {
        sweptAt: new Date().toISOString(),
        beacons,
        matches,
        audits,
        model,
        status,
      }

      if (mode === 'memory' || mode === 'both') options.memoryStore.setLatest(snapshot)
      if (mode === 'file' || mode === 'both') options.fileStore.append(snapshot)

      lastSnapshot = snapshot
      return snapshot
    } finally {
      // 异常后必须重置，否则永远不再巡检
      running = false
    }
  }

  return {
    run,
    isRunning: () => running,
  }
}

// 定时器：只在直接运行时调用（main.ts 的直接运行块内）
export function startSweepScheduler(options: {
  run: (model?: string) => Promise<unknown>
  intervalMs: number
  setIntervalFn?: typeof setInterval
}): () => void {
  const register = options.setIntervalFn ?? setInterval
  const timer = register(() => {
    void options.run().catch(() => undefined)
  }, options.intervalMs)

  return () => {
    clearInterval(timer)
  }
}
