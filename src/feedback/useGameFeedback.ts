import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { formatRuleDurationMs, type GameConfig } from '../domain/gameConfig'
import {
  type Card,
  type GameAction,
  type GameSession,
  type GameState,
} from '../domain/gameSession'
import { cancelDelayedSounds, playSound } from '../audio'
import { getWarningLevel } from '../presentation/warning'
import type { Feedback, MatchEffect } from './types'

export type GameFeedback = {
  feedback: Feedback
  matchEffect: MatchEffect | null
  frameRef: RefObject<HTMLElement | null>
  scoreRef: RefObject<HTMLDivElement | null>
  timeRef: RefObject<HTMLDivElement | null>
  registerCardRef: (cardId: string, element: HTMLButtonElement | null) => void
  onStart: () => void
  onSelect: (cardId: string) => void
}

type GameFeedbackOptions = {
  session: GameSession
  state: GameState
  config: GameConfig
  soundEnabled: boolean
  dispatch: (action: GameAction) => void
}

function findNewlyMatchedCards(state: GameState, previous: GameState): Card[] {
  return state.board.filter((card) => {
    if (card.status !== 'matched') return false
    const previousCard = previous.board.find((previousBoardCard) => previousBoardCard.id === card.id)
    return previousCard?.status !== 'matched'
  })
}

export function useGameFeedback({ session, state, config, soundEnabled, dispatch }: GameFeedbackOptions): GameFeedback {
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [matchEffect, setMatchEffect] = useState<MatchEffect | null>(null)
  const previousState = useRef(state)
  const previousSession = useRef(session)
  const soundEnabledRef = useRef(soundEnabled)
  const feedbackId = useRef(0)
  const countdownSecondPlayed = useRef<number | null>(null)
  const warningSecondPlayed = useRef<number | null>(null)
  const goldenSecondPlayed = useRef<number | null>(null)
  const frameRef = useRef<HTMLElement | null>(null)
  const scoreRef = useRef<HTMLDivElement | null>(null)
  const timeRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const matchEffectTimeout = useRef<number | null>(null)
  const impactSoundTimeout = useRef<number | null>(null)

  soundEnabledRef.current = soundEnabled

  const registerCardRef = useCallback((cardId: string, element: HTMLButtonElement | null) => {
    if (element) cardRefs.current.set(cardId, element)
    else cardRefs.current.delete(cardId)
  }, [])

  const clearEffectTimers = useCallback(() => {
    cancelDelayedSounds()
    if (matchEffectTimeout.current !== null) {
      window.clearTimeout(matchEffectTimeout.current)
      matchEffectTimeout.current = null
    }
    if (impactSoundTimeout.current !== null) {
      window.clearTimeout(impactSoundTimeout.current)
      impactSoundTimeout.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearEffectTimers()
  }, [clearEffectTimers])

  useEffect(() => {
    cancelDelayedSounds()
  }, [soundEnabled])

  useEffect(() => {
    const previous = previousState.current

    if (previousSession.current !== session) {
      previousSession.current = session
      previousState.current = state
      feedbackId.current = 0
      countdownSecondPlayed.current = null
      warningSecondPlayed.current = null
      goldenSecondPlayed.current = null
      clearEffectTimers()
      setFeedback(null)
      setMatchEffect(null)
      return
    }

    const newlyMatchedCards = findNewlyMatchedCards(state, previous)

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

        clearEffectTimers()
        setMatchEffect(nextMatchEffect)
        matchEffectTimeout.current = window.setTimeout(() => {
          setMatchEffect(null)
          matchEffectTimeout.current = null
        }, 760)
        impactSoundTimeout.current = window.setTimeout(() => {
          playSound('match-impact', soundEnabledRef.current)
          impactSoundTimeout.current = null
        }, 260)
      }
    }

    const goldenOutcomeChanged = state.goldenOutcome !== previous.goldenOutcome && state.goldenOutcome !== null
    if (goldenOutcomeChanged) {
      feedbackId.current += 1
      if (state.goldenOutcome === 'success') {
        setFeedback({
          kind: 'golden-match',
          scoreDeltaLabel: `+${config.scoring.matchScore + config.goldenEvent.successScoreBonus} SCORE • +${formatRuleDurationMs(config.goldenEvent.successTimeBonusMs).replace(' seconds', 's')}`,
          id: feedbackId.current,
        })
        playSound('golden-match', soundEnabled)
      } else {
        setFeedback({
          kind: 'golden-missed',
          scoreDeltaLabel: `-${formatRuleDurationMs(config.goldenEvent.failureTimePenaltyMs).replace(' seconds', 's')}`,
          id: feedbackId.current,
        })
        playSound('golden-missed', soundEnabled)
      }
    } else if (newlyMatchedCards.length >= 2) {
      feedbackId.current += 1
      setFeedback({ kind: 'match', scoreDeltaLabel: `+${config.scoring.matchScore}`, id: feedbackId.current })
      playSound('match', soundEnabled)
    } else if (state.phase === 'resolving-mismatch' && previous.phase !== 'resolving-mismatch') {
      feedbackId.current += 1
      setFeedback({ kind: 'mismatch', scoreDeltaLabel: `−${config.scoring.mismatchPenalty}`, id: feedbackId.current })
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
  }, [clearEffectTimers, config, session, soundEnabled, state])

  useEffect(() => {
    if (state.phase !== 'paused' && state.phase !== 'finished') return
    clearEffectTimers()
    setMatchEffect(null)
  }, [clearEffectTimers, session, state.phase])

  useEffect(() => {
    if (state.phase !== 'countdown' || state.countdownMs === null || state.countdownMs <= 0) {
      countdownSecondPlayed.current = null
      return
    }

    const countdownSecond = Math.ceil(state.countdownMs / 1000)
    if (countdownSecond !== countdownSecondPlayed.current) {
      countdownSecondPlayed.current = countdownSecond
      playSound('countdown', soundEnabled, { urgent: countdownSecond === 1 })
    }
  }, [session, soundEnabled, state.countdownMs, state.phase])

  useEffect(() => {
    const warningSecond = Math.ceil(state.remainingMs / 1000)
    const warningLevel = getWarningLevel(state)

    if (warningLevel !== 'none' && warningSecond !== warningSecondPlayed.current) {
      warningSecondPlayed.current = warningSecond
      playSound('warning', soundEnabled, { urgent: warningSecond <= 3 })
    }

    if (warningLevel === 'none') warningSecondPlayed.current = null
  }, [session, soundEnabled, state.phase, state.remainingMs])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 850)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const onStart = useCallback(() => {
    playSound('start', soundEnabled)
    dispatch({ type: 'begin' })
  }, [dispatch, soundEnabled])

  const onSelect = useCallback((cardId: string) => {
    playSound('flip', soundEnabled)
    dispatch({ type: 'select-card', cardId })
  }, [dispatch, soundEnabled])

  return {
    feedback,
    matchEffect,
    frameRef,
    scoreRef,
    timeRef,
    registerCardRef,
    onStart,
    onSelect,
  }
}
