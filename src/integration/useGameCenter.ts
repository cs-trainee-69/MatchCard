import { useEffect, useState, useSyncExternalStore } from 'react'
import type { GameSession, GameState } from '../domain/gameSession'
import { getGameCenter } from './gameCenter'

export function useGameCenter(session: GameSession, state: GameState) {
  const [center] = useState(getGameCenter)
  const remote = useSyncExternalStore(center.subscribe, center.snapshot)
  useEffect(() => {
    if (state.phase === 'finished') center.finish(session, state.score)
  }, [center, session, state.phase, state.score])
  return { ...remote, start: (activate: () => void) => center.start(session, activate), retry: center.retry, signIn: center.signIn }
}
