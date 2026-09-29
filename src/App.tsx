import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  type Card,
  createGameSession,
  GOLDEN_TIMER_MS,
  getBoardLayout,
  isClockRunningPhase,
  type GameAction,
  type GameSession,
  type GameState,
} from './domain/gameSession'
import { playSound } from './audio'
import { loadHighScore, loadSoundEnabled, saveHighScore, saveSoundEnabled } from './storage'

const CHARACTER_LABELS: Record<Card['character'], string> = {
  'cat-1': 'Cat 1',
  'cat-2': 'Cat 2',
  'cat-3': 'Cat 3',
  'cat-4': 'Cat 4',
  'cat-5': 'Cat 5',
  'cat-6': 'Cat 6',
  'cat-7': 'Cat 7',
  'cat-8': 'Cat 8',
  'cat-9': 'Cat 9',
  'cat-10': 'Cat 10',
}

const CHARACTER_IMAGES: Record<Card['character'], string> = {
  'cat-1': '/card/cat/cat-1.png',
  'cat-2': '/card/cat/cat-2.png',
  'cat-3': '/card/cat/cat-3.png',
  'cat-4': '/card/cat/cat-4.png',
  'cat-5': '/card/cat/cat-5.png',
  'cat-6': '/card/cat/cat-6.png',
  'cat-7': '/card/cat/cat-7.png',
  'cat-8': '/card/cat/cat-8.png',
  'cat-9': '/card/cat/cat-9.png',
  'cat-10': '/card/cat/cat-10.png',
}

const CELEBRATION_IMAGE = '/card/cat/cat-celebration.png'

type Feedback = { kind: 'match' | 'mismatch' | 'golden-match' | 'golden-missed'; scoreDeltaLabel: string; id: number } | null

type MatchEffect = {
  id: number
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  timeX: number
  timeY: number
  isGolden: boolean
}

function PawIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <ellipse cx="20" cy="27" rx="9" ry="8" />
      <circle cx="8.5" cy="16" r="4.5" />
      <circle cx="16" cy="10" r="4.5" />
      <circle cx="24" cy="10" r="4.5" />
      <circle cx="31.5" cy="16" r="4.5" />
    </svg>
  )
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(mediaQuery.matches)
    updatePreference()
    mediaQuery.addEventListener?.('change', updatePreference)

    return () => mediaQuery.removeEventListener?.('change', updatePreference)
  }, [])

  return reducedMotion
}

function formatTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
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
  isMismatch,
  isGolden,
  goldenSelectionLocked,
  cardRef,
  onSelect,
}: {
  card: Card
  index: number
  disabled: boolean
  isMismatch: boolean
  isGolden: boolean
  goldenSelectionLocked: boolean
  cardRef: (element: HTMLButtonElement | null) => void
  onSelect: (cardId: string) => void
}) {
  const isHidden = card.status === 'hidden'
  const isMatched = card.status === 'matched'
  const isGoldenCoverVisible = isGolden && isHidden
  const isDisabled = disabled || isMatched || (goldenSelectionLocked && !isGolden)
  const label = isGoldenCoverVisible
    ? 'Golden card: open to find its pair'
    : isHidden
      ? `Hidden card ${index + 1}`
      : `${CHARACTER_LABELS[card.character]} cat card`

  return (
    <button
      ref={cardRef}
      className={`card-button ${isHidden ? '' : 'is-revealed'} ${isMatched ? 'is-matched' : ''} ${isMismatch ? 'is-mismatch' : ''} ${isGoldenCoverVisible ? 'is-golden' : ''}`}
      type="button"
      aria-label={label}
      aria-pressed={!isHidden}
      data-golden={isGolden ? 'true' : undefined}
      disabled={isDisabled}
      onClick={() => onSelect(card.id)}
    >
      <span className="card-face card-back" aria-hidden="true">
        <img src="/card/cat-close.png" alt="" />
      </span>
      {isGoldenCoverVisible && (
        <span className="card-face golden-cover" aria-hidden="true">
          <img src="/card/cat/golden-cat.png" alt="" />
        </span>
      )}
      <span className="card-face card-front" aria-hidden="true">
        <img src={CHARACTER_IMAGES[card.character]} alt="" />
      </span>
      {isMismatch && <span className="mismatch-mark" aria-hidden="true">!?</span>}
    </button>
  )
}

function Hud({
  state,
  feedback,
  scoreRef,
  timeRef,
}: {
  state: GameState
  feedback: Feedback
  scoreRef: (element: HTMLDivElement | null) => void
  timeRef: (element: HTMLDivElement | null) => void
}) {
  const isWarning = state.remainingMs <= 10_000 && state.remainingMs > 0 && state.phase !== 'ready'
  const warningLevel = !isWarning ? 'none' : Math.ceil(state.remainingMs / 1000) <= 3 ? 'critical' : 'warning'

  return (
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
  )
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

function GoldenTimer({ remainingMs }: { remainingMs: number }) {
  const progress = Math.max(0, Math.min(100, remainingMs / GOLDEN_TIMER_MS * 100))
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

function MatchEffectLayer({ effect, reducedMotion }: { effect: MatchEffect; reducedMotion: boolean }) {
  const style = {
    '--match-x': `${effect.sourceX}px`,
    '--match-y': `${effect.sourceY}px`,
    '--target-x': `${effect.targetX}px`,
    '--target-y': `${effect.targetY}px`,
    '--time-x': `${effect.timeX}px`,
    '--time-y': `${effect.timeY}px`,
    '--travel-x': `${effect.targetX - effect.sourceX}px`,
    '--travel-y': `${effect.targetY - effect.sourceY}px`,
  } as CSSProperties

  return (
    <div
      className={`match-effect-layer ${reducedMotion ? 'is-reduced-motion' : ''}`}
      data-testid="match-effect-layer"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      style={style}
      aria-hidden="true"
    >
      <span className="match-effect-burst">
        <span className="match-spark match-spark-one">✦</span>
        <span className="match-spark match-spark-two">✧</span>
        <span className="match-spark match-spark-three">✦</span>
        <span className="match-spark match-spark-four">•</span>
      </span>
      <span className="match-effect-paw">
        <PawIcon className="paw-icon" />
      </span>
      <span className="match-effect-impact" />
      {effect.isGolden && <span className="match-effect-impact match-effect-time-impact" />}
    </div>
  )
}

function UrgencyVignette({ level }: { level: 'warning' | 'critical' }) {
  return <div className={`urgency-vignette urgency-${level}`} data-testid="urgency-vignette" data-urgency={level} aria-hidden="true" />
}

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
        <img className="round-celebration-cat" src={CELEBRATION_IMAGE} alt="" aria-hidden="true" />
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
      <div className="start-intro">
        <img className="start-cat" src={CELEBRATION_IMAGE} alt="" aria-hidden="true" />
        <div className="start-intro-copy">
          <p className="eyebrow">Cat Card</p>
          <p className="start-subtitle" lang="th">จับคู่แมวให้ครบก่อนเวลาหมด</p>
          <button className="start-prompt" type="button" lang="th" onClick={onStart}>
            <span className="start-button-paw" aria-hidden="true"><PawIcon className="paw-icon" /></span>
            <span>แตะเพื่อเริ่ม</span>
          </button>
        </div>
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

function GoldenAlertOverlay() {
  return (
    <div className="overlay overlay-golden-alert" data-testid="golden-alert" role="alert" aria-live="assertive">
      <div className="overlay-card golden-alert-card">
        <img className="golden-alert-cat" src="/card/cat/golden-cat.png" alt="" aria-hidden="true" />
        <p className="eyebrow">GOLDEN CAT!</p>
        <h2>Special card</h2>
        <p className="golden-alert-instruction" lang="th">เปิดแมวทอง แล้วหาคู่ให้ทันใน 5 วินาที!</p>
      </div>
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
    <div className="overlay overlay-result" data-testid="result-overlay">
      <div className="overlay-card result-card">
        <div className="result-sparkles" aria-hidden="true">
          <span>✦</span>
          <span>✧</span>
          <span>✦</span>
        </div>
        <img className="result-cat-card" src={CELEBRATION_IMAGE} alt="" aria-hidden="true" />
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

export default function App() {
  const [startingHighScore, setStartingHighScore] = useState(loadHighScore)
  const [session, setSession] = useState<GameSession>(() => createGameSession({ highScore: startingHighScore }))
  const [state, setState] = useState<GameState>(() => session.getState())
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [matchEffect, setMatchEffect] = useState<MatchEffect | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const previousState = useRef(state)
  const soundEnabledRef = useRef(soundEnabled)
  const feedbackId = useRef(0)
  const warningSecondPlayed = useRef<number | null>(null)
  const goldenSecondPlayed = useRef<number | null>(null)
  const frameRef = useRef<HTMLElement | null>(null)
  const scoreRef = useRef<HTMLDivElement | null>(null)
  const timeRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const matchEffectTimeout = useRef<number | null>(null)
  const impactSoundTimeout = useRef<number | null>(null)

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
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  useEffect(() => {
    const previous = previousState.current

    const newlyMatchedCards = state.board.filter((card) => {
      if (card.status !== 'matched') return false
      const previousCard = previous.board.find((previousBoardCard) => previousBoardCard.id === card.id)
      return previousCard?.status !== 'matched'
    })

    if (newlyMatchedCards.length >= 2) {
      const frame = frameRef.current
      const score = scoreRef.current
      const time = timeRef.current
      const sourceRects = newlyMatchedCards
        .slice(0, 2)
        .map((card) => cardRefs.current.get(card.id)?.getBoundingClientRect())
        .filter((rect): rect is DOMRect => Boolean(rect))

      if (frame && score && time && sourceRects.length === 2) {
        const frameRect = frame.getBoundingClientRect()
        const scoreRect = score.getBoundingClientRect()
        const timeRect = time.getBoundingClientRect()
        const sourceX = sourceRects.reduce((total, rect) => total + rect.left + rect.width / 2, 0) / sourceRects.length - frameRect.left
        const sourceY = sourceRects.reduce((total, rect) => total + rect.top + rect.height / 2, 0) / sourceRects.length - frameRect.top
        const targetX = scoreRect.left + scoreRect.width / 2 - frameRect.left
        const targetY = scoreRect.top + scoreRect.height / 2 - frameRect.top
        const timeX = timeRect.left + timeRect.width / 2 - frameRect.left
        const timeY = timeRect.top + timeRect.height / 2 - frameRect.top
        const isGolden = state.goldenOutcome === 'success' && previous.goldenOutcome !== 'success'
        const nextMatchEffect = { id: feedbackId.current + 1, sourceX, sourceY, targetX, targetY, timeX, timeY, isGolden }

        if (matchEffectTimeout.current !== null) window.clearTimeout(matchEffectTimeout.current)
        setMatchEffect(nextMatchEffect)
        matchEffectTimeout.current = window.setTimeout(() => setMatchEffect(null), 760)

        if (impactSoundTimeout.current !== null) window.clearTimeout(impactSoundTimeout.current)
        impactSoundTimeout.current = window.setTimeout(() => playSound('match-impact', soundEnabledRef.current), 260)
      }
    }

    const goldenOutcomeChanged = state.goldenOutcome !== previous.goldenOutcome && state.goldenOutcome !== null
    if (goldenOutcomeChanged) {
      feedbackId.current += 1
      if (state.goldenOutcome === 'success') {
        setFeedback({ kind: 'golden-match', scoreDeltaLabel: '+15 SCORE • +5s', id: feedbackId.current })
        playSound('golden-match', soundEnabled)
      } else {
        setFeedback({ kind: 'golden-missed', scoreDeltaLabel: '-5s', id: feedbackId.current })
        playSound('golden-missed', soundEnabled)
      }
    } else if (state.score > previous.score) {
      feedbackId.current += 1
      setFeedback({ kind: 'match', scoreDeltaLabel: '+10', id: feedbackId.current })
      playSound('match', soundEnabled)
    } else if (state.phase === 'resolving-mismatch' && previous.phase !== 'resolving-mismatch') {
      feedbackId.current += 1
      setFeedback({ kind: 'mismatch', scoreDeltaLabel: '−1', id: feedbackId.current })
      playSound('mismatch', soundEnabled)
    }

    if (state.phase === 'transitioning-round' && previous.phase !== 'transitioning-round') {
      playSound('round-complete', soundEnabled)
    }

    if (state.phase === 'golden-alert' && previous.phase !== 'golden-alert') {
      playSound('golden-alert', soundEnabled)
    }

    if (state.phase === 'golden-playing') {
      const goldenSecond = Math.ceil((state.goldenTimerMs ?? 0) / 1000)
      if (goldenSecond <= 3 && goldenSecond > 0 && goldenSecond !== goldenSecondPlayed.current) {
        goldenSecondPlayed.current = goldenSecond
        playSound('golden-tick', soundEnabled, { urgent: true })
      }
    } else {
      goldenSecondPlayed.current = null
    }

    if (state.phase === 'finished' && previous.phase !== 'finished') playSound('finish', soundEnabled)
    previousState.current = state
  }, [state, soundEnabled])

  useEffect(() => {
    if (state.phase !== 'paused' && state.phase !== 'finished') return

    if (matchEffectTimeout.current !== null) window.clearTimeout(matchEffectTimeout.current)
    if (impactSoundTimeout.current !== null) window.clearTimeout(impactSoundTimeout.current)
    setMatchEffect(null)
  }, [state.phase])

  useEffect(() => {
    const warningSecond = Math.ceil(state.remainingMs / 1000)
    const isWarning = state.remainingMs <= 10_000 && state.remainingMs > 0 && state.phase !== 'ready'

    if (isWarning && warningSecond !== warningSecondPlayed.current) {
      warningSecondPlayed.current = warningSecond
      playSound('warning', soundEnabled, { urgent: warningSecond <= 3 })
    }

    if (!isWarning) warningSecondPlayed.current = null
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
    setMatchEffect(null)
  }

  const boardLayout = getBoardLayout(state.round)
  const cardsDisabled = state.phase !== 'playing' && state.phase !== 'golden-playing'
  const goldenSelectionLocked = state.phase === 'golden-playing' && state.selectedCardIds.length === 0

  return (
    <main className="app-shell">
      <section ref={frameRef} className={`game-frame ${prefersReducedMotion ? 'prefers-reduced-motion' : ''}`} data-motion={prefersReducedMotion ? 'reduced' : 'full'} aria-label="Cat Card matching game">
        <div className="game-backdrop" />
        <div className="game-content">
          <Hud
            state={state}
            feedback={feedback}
            scoreRef={(element) => { scoreRef.current = element }}
            timeRef={(element) => { timeRef.current = element }}
          />
          {state.goldenTimerMs !== null && <GoldenTimer remainingMs={state.goldenTimerMs} />}
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
                    isMismatch={
                      (state.phase === 'resolving-mismatch' || state.phase === 'golden-resolving-mismatch') &&
                      state.selectedCardIds.includes(card.id)
                    }
                    isGolden={
                      (state.goldenEventStatus === 'alert' || state.goldenEventStatus === 'active') &&
                      state.goldenCardId === card.id
                    }
                    goldenSelectionLocked={goldenSelectionLocked}
                    cardRef={(element) => {
                      if (element) cardRefs.current.set(card.id, element)
                      else cardRefs.current.delete(card.id)
                    }}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="game-footer">
            <span className="footer-hint">
              <PawIcon className="paw-icon" />
              <span>Match the curious cats</span>
            </span>
            <button className="sound-button" type="button" onClick={handleToggleSound} aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}>
              <SoundIcon enabled={soundEnabled} />
            </button>
          </div>
          {state.phase === 'ready' && <StartOverlay onStart={handleStart} />}
          {state.phase === 'countdown' && <CountdownOverlay countdownMs={state.countdownMs} />}
          {state.phase === 'first-turn-hint' && <FirstTurnHintOverlay />}
          {state.phase === 'golden-alert' && <GoldenAlertOverlay />}
          {state.phase === 'paused' && <PauseOverlay onResume={() => dispatch({ type: 'resume' })} />}
          {matchEffect && <MatchEffectLayer effect={matchEffect} reducedMotion={prefersReducedMotion} />}
          {state.remainingMs <= 10_000 && state.remainingMs > 0 && state.phase !== 'ready' && (
            <UrgencyVignette level={Math.ceil(state.remainingMs / 1000) <= 3 ? 'critical' : 'warning'} />
          )}
          {state.phase === 'transitioning-round' && (
            <RoundCelebration state={state} />
          )}
          {state.phase === 'finished' && (
            <ResultOverlay state={state} isNewHighScore={state.score > startingHighScore} onReplay={handleReplay} />
          )}
        </div>
      </section>
    </main>
  )
}
