export type Feedback = {
  kind: 'match' | 'mismatch' | 'golden-match' | 'golden-missed'
  scoreDeltaLabel: string
  id: number
} | null

export type MatchEffect = {
  id: number
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  timeX: number
  timeY: number
  isGolden: boolean
}
