export interface Beacon {
  id: string
  title: string
  url: string
  source: string
  score: number
  publishedAt: string
}

export interface BeaconSource {
  name: string
  collect(): Promise<Beacon[]>
}
