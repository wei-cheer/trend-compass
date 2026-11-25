import type { Beacon } from '../beacon/types.js'
import type { WatchTerm } from '../watchterm/types.js'
import type { BeaconMatch } from './types.js'

// 纯函数：只取启用词，大小写不敏感子串匹配，matchedTerms 保留词原文，无命中保留空数组
export function matchBeacons(beacons: Beacon[], terms: WatchTerm[]): BeaconMatch[] {
  const activeTerms = terms.filter((term) => term.isActive)

  return beacons.map((beacon) => {
    const title = beacon.title.toLowerCase()
    const matchedTerms = activeTerms
      .filter((term) => title.includes(term.text.toLowerCase()))
      .map((term) => term.text)

    return { beaconId: beacon.id, matchedTerms }
  })
}
