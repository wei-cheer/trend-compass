export type WatchCategory = 'official' | 'other-game' | 'outside'

export interface WatchTerm {
  id: string
  text: string
  category: WatchCategory
  isActive: boolean
  createdAt: string
}
