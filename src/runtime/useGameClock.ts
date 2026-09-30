import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { isClockRunningPhase, type GameSession, type GameState } from '../domain/gameSession'

export function useGameClock(
  session: GameSession,
  setState: Dispatch<SetStateAction<GameState>>,
  phase: GameState['phase'],
): void {
  useEffect(() => {
    if (!isClockRunningPhase(phase)) return

    const interval = window.setInterval(() => {
      if (isClockRunningPhase(session.getState().phase)) {
        setState(session.dispatch({ type: 'tick', deltaMs: 100 }))
      }
    }, 100)

    return () => window.clearInterval(interval)
  }, [session, setState, phase])
}
