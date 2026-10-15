import { useState } from 'react'
import { unlockAudio } from '../audio'
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
import { useGameCenter } from '../integration/useGameCenter'
import { LeaderboardDialog, SubmissionStatus } from './GameCenterViews'

export type GameScreenProps = {
  config?: GameConfig
}

export default function GameScreen({ config: requestedConfig }: GameScreenProps = {}) {
  const runtime = useGameSessionRuntime(requestedConfig)
  const center = useGameCenter(runtime.session, runtime.state)
  const [rankingOpen, setRankingOpen] = useState(false)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const prefersReducedMotion = useReducedMotion()
  const feedback = useGameFeedback({
    session: runtime.session,
    state: runtime.state,
    config: runtime.config,
    soundEnabled,
    dispatch: runtime.dispatch,
  })
  const centerPanel = <aside className="gc-panel" aria-label="Game Center">
    {center.access === 'connecting' && <p role="status">กำลังตรวจสิทธิ์เข้าเกม…</p>}
    {center.starting && <p role="status">กำลังเริ่มรอบออนไลน์…</p>}
    {center.error && <div role="alert"><p>{center.error}</p><button type="button" className="gc-button" onClick={center.signIn}>เข้าสู่ระบบใหม่</button></div>}
    {center.submissions.filter((item, index) => index === center.submissions.length - 1 || item.status === 'error' || item.status === 'sending').map(item => <SubmissionStatus key={item.id} submission={item} retry={center.retry} />)}
    {runtime.state.phase === 'finished' && <p className="gc-local-note">High Score เป็นสถิติในอุปกรณ์นี้</p>}
    <button type="button" className="gc-button" onClick={() => setRankingOpen(true)}>ดูอันดับออนไลน์</button>
  </aside>

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
            onStart={() => { unlockAudio(soundEnabled); void center.start(feedback.onStart) }}
            startDisabled={center.access !== 'ready' || center.starting}
            onResume={() => runtime.dispatch({ type: 'resume' })}
            onReplay={runtime.replay}
            resultFooter={centerPanel}
          />
          {runtime.state.phase === 'ready' && centerPanel}
          {rankingOpen && <LeaderboardDialog onClose={() => setRankingOpen(false)} />}
          {feedback.matchEffect && <MatchEffectLayer effect={feedback.matchEffect} reducedMotion={prefersReducedMotion} />}
        </div>
      </section>
    </main>
  )
}
