import type { GameConfig } from '../domain/gameConfig'
import { MatchEffectLayer } from '../feedback/MatchEffectLayer'
import { useGameFeedback } from '../feedback/useGameFeedback'
import { Board } from './Board'
import { GameFooter } from './GameFooter'
import { GamePhaseViews } from './GamePhaseViews'
import { Hud } from './Hud'
import { useReducedMotion } from './useReducedMotion'
import { useGameSessionRuntime } from '../runtime/useGameSessionRuntime'
import { useSoundPreference } from '../runtime/useSoundPreference'

export type GameScreenProps = {
  config?: GameConfig
}

export default function GameScreen({ config: requestedConfig }: GameScreenProps = {}) {
  const runtime = useGameSessionRuntime(requestedConfig)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const prefersReducedMotion = useReducedMotion()
  const feedback = useGameFeedback({
    session: runtime.session,
    state: runtime.state,
    config: runtime.config,
    soundEnabled,
    dispatch: runtime.dispatch,
  })

  return (
    <main className="app-shell">
      <section
        ref={feedback.frameRef}
        className={`game-frame ${prefersReducedMotion ? 'prefers-reduced-motion' : ''}`}
        data-motion={prefersReducedMotion ? 'reduced' : 'full'}
        aria-label="Cat Card matching game"
      >
        <div className="game-backdrop" />
        <div className="game-content">
          <Hud
            state={runtime.state}
            config={runtime.config}
            feedback={feedback.feedback}
            scoreRef={feedback.scoreRef}
            timeRef={feedback.timeRef}
          />
          <Board
            cards={runtime.state.board}
            round={runtime.state.round}
            phase={runtime.state.phase}
            selectedCardIds={runtime.state.selectedCardIds}
            goldenEventStatus={runtime.state.goldenEventStatus}
            goldenCardId={runtime.state.goldenCardId}
            config={runtime.config}
            registerCardRef={feedback.registerCardRef}
            onSelect={feedback.onSelect}
          />
          <GameFooter soundEnabled={soundEnabled} onToggleSound={toggleSound} />
          <GamePhaseViews
            state={runtime.state}
            config={runtime.config}
            startingHighScore={runtime.startingHighScore}
            onStart={feedback.onStart}
            onResume={() => runtime.dispatch({ type: 'resume' })}
            onReplay={runtime.replay}
          />
          {feedback.matchEffect && <MatchEffectLayer effect={feedback.matchEffect} reducedMotion={prefersReducedMotion} />}
        </div>
      </section>
    </main>
  )
}
