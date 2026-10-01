import { type GameState } from '../domain/gameSession'
import { formatRuleDurationMs, type GameConfig } from '../domain/gameConfig'
import { PawIcon } from './PawIcon'
import { getWarningLevel } from './warning'
import { CELEBRATION_IMAGE, GOLDEN_IMAGE } from './gameImages'
import { GameImage } from './GameImage'

function RoundCelebration({ state }: { state: GameState }) {
  return (
    <div className="round-celebration" role="status" aria-live="polite">
      <div className="round-confetti" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} className={`round-confetti-piece round-confetti-piece-${index + 1}`}>
            <PawIcon className="paw-icon" />
          </span>
        ))}
      </div>
      <div className="round-celebration-card">
        <GameImage className="round-celebration-cat" src={CELEBRATION_IMAGE} sizes="112px" alt="" aria-hidden="true" />
        <div className="round-celebration-copy">
          <p className="eyebrow">Round complete</p>
          <strong>Round {state.round + 1}</strong>
        </div>
      </div>
    </div>
  )
}

function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="overlay overlay-start">
      <GameImage className="start-cat" src={CELEBRATION_IMAGE} sizes="140px" alt="" aria-hidden="true" />
      <div className="start-floating-copy">
        <p className="eyebrow">Cat Card</p>
        <p className="start-subtitle" lang="th">จับคู่แมวให้ครบก่อนเวลาหมด</p>
        <button className="start-prompt" type="button" lang="th" onClick={onStart}>
          แตะเพื่อเริ่ม
        </button>
      </div>
    </div>
  )
}

function CountdownOverlay({ countdownMs }: { countdownMs: number | null }) {
  return (
    <div className="overlay overlay-countdown" aria-live="assertive">
      <div className="countdown-number">{Math.max(1, Math.ceil((countdownMs ?? 0) / 1000))}</div>
    </div>
  )
}

function FirstTurnHintOverlay() {
  return (
    <div className="overlay overlay-first-turn-hint" role="status" aria-live="polite">
      <p className="first-turn-hint" lang="th">จับคู่ไพ่</p>
    </div>
  )
}

function GoldenAlertOverlay({ timerMs }: { timerMs: number }) {
  return (
    <div className="overlay overlay-golden-alert" data-testid="golden-alert" role="alert" aria-live="assertive">
      <div className="overlay-card golden-alert-card">
        <GameImage className="golden-alert-cat" src={GOLDEN_IMAGE} sizes="90px" alt="" aria-hidden="true" />
        <p className="eyebrow">GOLDEN CAT!</p>
        <h2>Special card</h2>
        <p className="golden-alert-instruction" lang="th">เปิดแมวทอง แล้วหาคู่ให้ทันใน {formatRuleDurationMs(timerMs).replace(' seconds', ' วินาที')}!</p>
      </div>
    </div>
  )
}

function PauseOverlay({ onResume }: { onResume: () => void }) {
  return (
    <div className="overlay overlay-pause">
      <div className="overlay-card">
        <p className="eyebrow">Game paused</p>
        <h2>Take a breath</h2>
        <p className="overlay-copy">Your time is safe. Get ready before you continue.</p>
        <button className="primary-button" type="button" onClick={onResume}>
          Resume
        </button>
      </div>
    </div>
  )
}

function ResultOverlay({ state, isNewHighScore, onReplay }: { state: GameState; isNewHighScore: boolean; onReplay: () => void }) {
  return (
    <div className="overlay overlay-result" data-testid="result-overlay">
      <div className="overlay-card result-card">
        <div className="result-sparkles" aria-hidden="true">
          <span>✦</span>
          <span>✧</span>
          <span>✦</span>
        </div>
        <GameImage className="result-cat-card" src={CELEBRATION_IMAGE} sizes="112px" alt="" aria-hidden="true" />
        <div className="result-card-content">
          <p className="eyebrow">Game Result</p>
          <h2>Time's up</h2>
          {isNewHighScore && <p className="new-high-score"><span aria-hidden="true">✦</span> New High Score <span aria-hidden="true">✦</span></p>}
          <div className="result-grid">
            <div className="result-stat" data-stat="score">
              <span className="result-label">Score</span>
              <strong>{state.score}</strong>
            </div>
            <div className="result-stat" data-stat="high-score">
              <span className="result-label">High Score</span>
              <strong>{state.highScore}</strong>
            </div>
            <div className="result-stat" data-stat="round">
              <span className="result-label">Round</span>
              <strong>{state.round}</strong>
            </div>
          </div>
          <button className="primary-button result-replay-button" type="button" onClick={onReplay}>
            <span className="result-button-paw" aria-hidden="true"><PawIcon className="paw-icon" /></span>
            <span>Play again</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function UrgencyVignette({ level }: { level: 'warning' | 'critical' }) {
  return <div className={`urgency-vignette urgency-${level}`} data-testid="urgency-vignette" data-urgency={level} aria-hidden="true" />
}

export type GamePhaseViewsProps = {
  state: GameState
  config: GameConfig
  startingHighScore: number
  onStart: () => void
  onResume: () => void
  onReplay: () => void
}

export function GamePhaseViews({ state, config, startingHighScore, onStart, onResume, onReplay }: GamePhaseViewsProps) {
  const warningLevel = getWarningLevel(state)

  return (
    <>
      {state.phase === 'ready' && <StartOverlay onStart={onStart} />}
      {state.phase === 'countdown' && <CountdownOverlay countdownMs={state.countdownMs} />}
      {state.phase === 'first-turn-hint' && <FirstTurnHintOverlay />}
      {state.phase === 'golden-alert' && <GoldenAlertOverlay timerMs={config.goldenEvent.timerMs} />}
      {state.phase === 'paused' && <PauseOverlay onResume={onResume} />}
      {warningLevel !== 'none' && <UrgencyVignette level={warningLevel} />}
      {state.phase === 'transitioning-round' && <RoundCelebration state={state} />}
      {state.phase === 'finished' && <ResultOverlay state={state} isNewHighScore={state.score > startingHighScore} onReplay={onReplay} />}
    </>
  )
}
