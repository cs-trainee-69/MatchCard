import type { GameState } from '../domain/gameSession'

export type WarningLevel = 'none' | 'warning' | 'critical'

export function getWarningLevel(state: Pick<GameState, 'remainingMs' | 'phase'>): WarningLevel {
  if (state.remainingMs <= 0 || state.remainingMs > 10_000 || state.phase === 'ready') return 'none'
  return Math.ceil(state.remainingMs / 1000) <= 3 ? 'critical' : 'warning'
}
