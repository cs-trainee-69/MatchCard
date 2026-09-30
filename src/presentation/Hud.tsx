import type { Ref } from 'react'
import type { GameConfig } from '../domain/gameConfig'
import type { GameState } from '../domain/gameSession'
import type { Feedback } from '../feedback/types'
import { getWarningLevel } from './warning'

function formatTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function FeedbackToast({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null

  return (
    <div key={feedback.id} className={`feedback-toast feedback-${feedback.kind}`} role="status" aria-live="polite">
      <strong>
        {feedback.kind === 'match'
          ? 'MATCH!'
          : feedback.kind === 'mismatch'
            ? 'MISMATCH!'
            : feedback.kind === 'golden-match'
              ? 'GOLDEN MATCH!'
              : 'GOLDEN MISSED!'}
      </strong>
      <span>{feedback.scoreDeltaLabel}</span>
    </div>
  )
}

function GoldenTimer({ remainingMs, durationMs }: { remainingMs: number; durationMs: number }) {
  const progress = Math.max(0, Math.min(100, remainingMs / durationMs * 100))
  const level = remainingMs <= 1_000 ? 'critical' : remainingMs <= 2_000 ? 'warning' : 'normal'

  return (
    <div className="golden-timer" data-testid="golden-timer" data-timer-level={level} role="status" aria-live="polite">
      <div className="golden-timer-heading">
        <img className="golden-timer-icon" src="/card/cat/golden-cat.png" alt="" aria-hidden="true" />
        <span>Golden Timer</span>
        <strong>{(remainingMs / 1000).toFixed(1)}s</strong>
      </div>
      <div className="golden-timer-track" aria-hidden="true">
        <span className="golden-timer-progress" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

export type HudProps = {
  state: GameState
  config: GameConfig
  feedback: Feedback
  scoreRef: Ref<HTMLDivElement>
  timeRef: Ref<HTMLDivElement>
}

export function Hud({ state, config, feedback, scoreRef, timeRef }: HudProps) {
  const warningLevel = getWarningLevel(state)
  const isWarning = warningLevel !== 'none'

  return (
    <>
      <header className="hud">
        <div className="hud-stat hud-round">
          <span className="hud-label">Round</span>
          <strong className="hud-value">{state.round}</strong>
        </div>
        <div ref={scoreRef} className="hud-stat hud-score">
          <span className="hud-label">Score</span>
          <strong key={feedback?.id ?? 'score'} className="hud-value score-value">
            {state.score}
          </strong>
          <FeedbackToast feedback={feedback} />
        </div>
        <div ref={timeRef} className={`hud-stat hud-time ${isWarning ? 'is-warning' : ''} ${warningLevel === 'critical' ? 'is-critical' : ''}`} data-warning-level={warningLevel}>
          <span className="hud-label">Time</span>
          <strong className="hud-value">{formatTime(state.remainingMs)}</strong>
        </div>
      </header>
      {state.goldenTimerMs !== null && <GoldenTimer remainingMs={state.goldenTimerMs} durationMs={config.goldenEvent.timerMs} />}
    </>
  )
}
