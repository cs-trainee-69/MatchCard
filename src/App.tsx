import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Card,
  createGameSession,
  getBoardLayout,
  type GameAction,
  type GameSession,
  type GameState,
} from './domain/gameSession'
import { playSound } from './audio'
import { loadHighScore, loadSoundEnabled, saveHighScore, saveSoundEnabled } from './storage'

const CHARACTER_LABELS: Record<Card['character'], string> = {
  alien: 'Alien',
  cowboy: 'Cowboy',
  doctor: 'Doctor',
  fish: 'Fish',
  griffin: 'Griffin',
  octopus: 'Octopus',
  police: 'Police',
  space: 'Space',
  witch: 'Witch',
}

const CHARACTER_IMAGES: Record<Card['character'], string> = {
  alien: '/card/cat/alien-cat.png',
  cowboy: '/card/cat/cowboy-cat.png',
  doctor: '/card/cat/doctor-cat.png',
  fish: '/card/cat/fish-cat.png',
  griffin: '/card/cat/griffin-cat.png',
  octopus: '/card/cat/octopus-cat.png',
  police: '/card/cat/police-cat.png',
  space: '/card/cat/space-cat.png',
  witch: '/card/cat/witch-cat.png',
}

type Feedback = { kind: 'match' | 'mismatch'; scoreDeltaLabel: string; id: number } | null

function formatTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function isClockRunningPhase(phase: GameState['phase']): boolean {
  return (
    phase === 'countdown' ||
    phase === 'first-turn-hint' ||
    phase === 'playing' ||
    phase === 'resolving-mismatch' ||
    phase === 'transitioning-round'
  )
}

function useGameClock(session: GameSession, setState: (state: GameState) => void, phase: GameState['phase']): void {
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

function CardButton({
  card,
  index,
  disabled,
  onSelect,
}: {
  card: Card
  index: number
  disabled: boolean
  onSelect: (cardId: string) => void
}) {
  const isHidden = card.status === 'hidden'
  const isMatched = card.status === 'matched'
  const label = isHidden ? `Hidden card ${index + 1}` : `${CHARACTER_LABELS[card.character]} cat card`

  return (
    <button
      className={`card-button ${isHidden ? '' : 'is-revealed'} ${isMatched ? 'is-matched' : ''}`}
      type="button"
      aria-label={label}
      aria-pressed={!isHidden}
      disabled={disabled || isMatched}
      onClick={() => onSelect(card.id)}
    >
      <span className="card-face card-back" aria-hidden="true">
        <img src="/card/cat-close.png" alt="" />
      </span>
      <span className="card-face card-front" aria-hidden="true">
        <img src={CHARACTER_IMAGES[card.character]} alt="" />
      </span>
    </button>
  )
}

function Hud({ state, feedback }: { state: GameState; feedback: Feedback }) {
  const isWarning = state.remainingMs <= 10_000 && state.remainingMs > 0 && state.phase !== 'ready'

  return (
    <header className="hud">
      <div className="hud-stat hud-round">
        <span className="hud-label">Round</span>
        <strong className="hud-value">{state.round}</strong>
      </div>
      <div className="hud-stat hud-score">
        <span className="hud-label">Score</span>
        <strong key={feedback?.id ?? 'score'} className="hud-value score-value">
          {state.score}
        </strong>
        <FeedbackToast feedback={feedback} />
      </div>
      <div className={`hud-stat hud-time ${isWarning ? 'is-warning' : ''}`}>
        <span className="hud-label">Time</span>
        <strong className="hud-value">{formatTime(state.remainingMs)}</strong>
      </div>
    </header>
  )
}

function FeedbackToast({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null

  return (
    <div key={feedback.id} className={`feedback-toast feedback-${feedback.kind}`} role="status" aria-live="polite">
      <strong>{feedback.kind === 'match' ? 'MATCH!' : 'MISMATCH!'}</strong>
      <span>{feedback.scoreDeltaLabel}</span>
    </div>
  )
}

function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="overlay overlay-start">
      <button className="start-prompt" type="button" lang="th" onClick={onStart}>
        แตะเพื่อเริ่ม
      </button>
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

function SoundIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg className="sound-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 10v4h3l4 3V7l-4 3H4Z" />
      {enabled ? <path d="M15 9.5a4 4 0 0 1 0 5" /> : <path d="m16 9 5 6m0-6-5 6" />}
    </svg>
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
    <div className="overlay overlay-result">
      <div className="overlay-card result-card">
        <p className="eyebrow">Time's up</p>
        <h2>Nice work!</h2>
        {isNewHighScore && <p className="new-high-score">New High Score</p>}
        <div className="result-grid">
          <div>
            <span className="hud-label">Score</span>
            <strong>{state.score}</strong>
          </div>
          <div>
            <span className="hud-label">High Score</span>
            <strong>{state.highScore}</strong>
          </div>
          <div>
            <span className="hud-label">Round</span>
            <strong>{state.round}</strong>
          </div>
        </div>
        <button className="primary-button" type="button" onClick={onReplay}>
          Play again
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [startingHighScore, setStartingHighScore] = useState(loadHighScore)
  const [session, setSession] = useState<GameSession>(() => createGameSession({ highScore: startingHighScore }))
  const [state, setState] = useState<GameState>(() => session.getState())
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const previousState = useRef(state)
  const feedbackId = useRef(0)
  const warningPlayed = useRef(false)

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

  useEffect(() => {
    const previous = previousState.current
    if (state.score > previous.score) {
      feedbackId.current += 1
      setFeedback({ kind: 'match', scoreDeltaLabel: '+10', id: feedbackId.current })
      playSound('match', soundEnabled)
    } else if (state.phase === 'resolving-mismatch' && previous.phase !== 'resolving-mismatch') {
      feedbackId.current += 1
      setFeedback({ kind: 'mismatch', scoreDeltaLabel: '−1', id: feedbackId.current })
      playSound('mismatch', soundEnabled)
    }

    if (state.phase === 'finished' && previous.phase !== 'finished') playSound('finish', soundEnabled)
    previousState.current = state
  }, [state, soundEnabled])

  useEffect(() => {
    if (state.remainingMs <= 10_000 && state.remainingMs > 0 && !warningPlayed.current) {
      warningPlayed.current = true
      playSound('warning', soundEnabled)
    }
    if (state.phase === 'ready') warningPlayed.current = false
  }, [state.phase, state.remainingMs, soundEnabled])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 850)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const handleStart = () => {
    playSound('flip', soundEnabled)
    dispatch({ type: 'begin' })
  }

  const handleSelect = (cardId: string) => {
    playSound('flip', soundEnabled)
    dispatch({ type: 'select-card', cardId })
  }

  const handleToggleSound = () => {
    setSoundEnabled((enabled) => {
      const next = !enabled
      saveSoundEnabled(next)
      return next
    })
  }

  const handleReplay = () => {
    const nextSession = createGameSession({ highScore: state.highScore })
    setStartingHighScore(state.highScore)
    setSession(nextSession)
    setState(nextSession.getState())
    setFeedback(null)
  }

  const boardLayout = getBoardLayout(state.round)
  const cardsDisabled = state.phase !== 'playing'

  return (
    <main className="app-shell">
      <section className="game-frame" aria-label="Cat Card matching game">
        <div className="game-backdrop" />
        <div className="game-content">
          <Hud state={state} feedback={feedback} />
          <div className="board-wrap">
            {state.board.length > 0 && (
              <div
                className="board-layout"
                data-board-layout={`${boardLayout.rows}x${boardLayout.columns}`}
                style={{ gridTemplateColumns: `repeat(${boardLayout.columns}, minmax(0, 1fr))` }}
              >
                {state.board.map((card, index) => (
                  <CardButton
                    key={card.id}
                    card={card}
                    index={index}
                    disabled={cardsDisabled}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="game-footer">
            <span className="footer-hint">Match the curious cats</span>
            <button className="sound-button" type="button" onClick={handleToggleSound} aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}>
              <SoundIcon enabled={soundEnabled} />
            </button>
          </div>
          {state.phase === 'ready' && <StartOverlay onStart={handleStart} />}
          {state.phase === 'countdown' && <CountdownOverlay countdownMs={state.countdownMs} />}
          {state.phase === 'first-turn-hint' && <FirstTurnHintOverlay />}
          {state.phase === 'paused' && <PauseOverlay onResume={() => dispatch({ type: 'resume' })} />}
          {state.phase === 'transitioning-round' && (
            <div className="round-banner" role="status">Round {state.round + 1}</div>
          )}
          {state.phase === 'finished' && (
            <ResultOverlay state={state} isNewHighScore={state.score > startingHighScore} onReplay={handleReplay} />
          )}
        </div>
      </section>
    </main>
  )
}
