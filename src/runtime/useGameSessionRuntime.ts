import { useCallback, useEffect, useState } from 'react'
import {
  createGameSession,
  type GameAction,
  type GameSession,
  type GameState,
} from '../domain/gameSession'
import { createGameConfig, type GameConfig } from '../domain/gameConfig'
import { loadHighScore, saveHighScore } from '../storage'
import { useGameClock } from './useGameClock'

export type GameSessionRuntime = {
  session: GameSession
  state: GameState
  config: GameConfig
  startingHighScore: number
  dispatch: (action: GameAction) => void
  replay: () => void
}

function createRuntimeSession(requestedConfig: GameConfig | undefined, highScore: number): GameSession {
  return createGameSession({
    config: requestedConfig ?? createGameConfig(),
    highScore,
  })
}

export function useGameSessionRuntime(requestedConfig?: GameConfig): GameSessionRuntime {
  const [startingHighScore, setStartingHighScore] = useState(loadHighScore)
  const [session, setSession] = useState<GameSession>(() => createRuntimeSession(requestedConfig, startingHighScore))
  const [state, setState] = useState<GameState>(() => session.getState())

  const dispatch = useCallback(
    (action: GameAction) => {
      setState(session.dispatch(action))
    },
    [session],
  )

  useGameClock(session, setState, state.phase)

  useEffect(() => {
    const handleVisibility = () => {
      const currentPhase = session.getState().phase
      if (document.hidden) {
        if (currentPhase !== 'ready' && currentPhase !== 'finished' && currentPhase !== 'paused') {
          setState(session.dispatch({ type: 'pause' }))
        }
      } else if (currentPhase === 'paused') {
        setState(session.dispatch({ type: 'resume' }))
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [session])

  useEffect(() => {
    if (state.highScore > loadHighScore()) saveHighScore(state.highScore)
  }, [state.highScore])

  const replay = useCallback(() => {
    const nextSession = createRuntimeSession(requestedConfig, state.highScore)
    setStartingHighScore(state.highScore)
    setSession(nextSession)
    setState(nextSession.getState())
  }, [requestedConfig, state.highScore])

  return {
    session,
    state,
    config: session.getConfig(),
    startingHighScore,
    dispatch,
    replay,
  }
}
