import { CAT_CHARACTER_IDS, type CatCharacterId } from './catCharacters'
import { DEFAULT_RESOLVED_GAME_CONFIG, type GameConfig, type RoundLayout } from './gameConfig'

export { CAT_CHARACTER_IDS, type CatCharacterId } from './catCharacters'
export {
  DEFAULT_GAME_CONFIG,
  DEFAULT_RESOLVED_GAME_CONFIG,
  createGameConfig,
  formatRuleDurationMs,
  InvalidGameConfigError,
  type GameConfig,
  type GameConfigOverrides,
  type GameConfigShape,
  type RoundLayout,
} from './gameConfig'

export type BoardSize = number
export type BoardLayout = RoundLayout

export type GamePhase =
  | 'ready'
  | 'countdown'
  | 'first-turn-hint'
  | 'playing'
  | 'golden-alert'
  | 'golden-playing'
  | 'golden-resolving-mismatch'
  | 'resolving-mismatch'
  | 'transitioning-round'
  | 'paused'
  | 'finished'

type ResumablePhase =
  | 'first-turn-hint'
  | 'playing'
  | 'golden-alert'
  | 'golden-playing'
  | 'golden-resolving-mismatch'
  | 'resolving-mismatch'
  | 'transitioning-round'
type PausablePhase = ResumablePhase | 'countdown'

const CLOCK_RUNNING_PHASES: readonly GamePhase[] = [
  'countdown',
  'first-turn-hint',
  'playing',
  'golden-alert',
  'golden-playing',
  'golden-resolving-mismatch',
  'resolving-mismatch',
  'transitioning-round',
]

export function isClockRunningPhase(phase: GamePhase): phase is PausablePhase {
  return CLOCK_RUNNING_PHASES.includes(phase)
}

export type Card = {
  id: string
  character: CatCharacterId
  status: 'hidden' | 'revealed' | 'matched'
}

export type GoldenEventStatus = 'unavailable' | 'scheduled' | 'alert' | 'active' | 'completed' | 'cancelled'
export type GoldenOutcome = 'success' | 'failure' | null

export type GameState = {
  phase: GamePhase
  board: Card[]
  round: number
  score: number
  highScore: number
  remainingMs: number
  countdownMs: number | null
  firstTurnHintMs: number | null
  selectedCardIds: string[]
  pendingResolutionMs: number | null
  transitionRemainingMs: number | null
  countdownTarget: ResumablePhase | null
  pausedFrom: PausablePhase | null
  goldenEventStatus: GoldenEventStatus
  goldenScheduleMs: number | null
  goldenAlertMs: number | null
  goldenTimerMs: number | null
  goldenCardId: string | null
  goldenOutcome: GoldenOutcome
}

export type GameAction =
  | { type: 'begin' }
  | { type: 'tick'; deltaMs: number }
  | { type: 'select-card'; cardId: string }
  | { type: 'pause' }
  | { type: 'resume' }

export type GameSessionRuntimeOptions = {
  random?: () => number
  highScore?: number
}

export type GameSessionOptions = GameSessionRuntimeOptions & {
  config?: GameConfig
}

export type GameSession = {
  getState: () => GameState
  getConfig: () => GameConfig
  dispatch: (action: GameAction) => GameState
}

const CAT_CHARACTERS: CatCharacterId[] = [...CAT_CHARACTER_IDS]

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

export function getBoardLayout(round: number, config: GameConfig = DEFAULT_RESOLVED_GAME_CONFIG): BoardLayout {
  const roundIndex = Math.min(Math.max(Math.floor(round), 1) - 1, config.rounds.layouts.length - 1)
  return config.rounds.layouts[roundIndex]
}

function createBoard(round: number, config: GameConfig, random: () => number): Card[] {
  const boardSize = getBoardLayout(round, config).cardCount
  const characterCount = boardSize / 2
  const characters = shuffle(CAT_CHARACTERS, random)

  const cards = characters.slice(0, characterCount).flatMap((character, characterIndex) => [
    { id: `${round}-${characterIndex}-a`, character, status: 'hidden' as const },
    { id: `${round}-${characterIndex}-b`, character, status: 'hidden' as const },
  ])

  return shuffle(cards, random)
}

function randomIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)))
}

function getGoldenScheduleDelay(config: GameConfig, random: () => number): number {
  const range = config.goldenEvent.scheduleDelayMaxMs - config.goldenEvent.scheduleDelayMinMs + 1
  return config.goldenEvent.scheduleDelayMinMs + randomIndex(range, random)
}

function chooseGoldenCardId(board: Card[], config: GameConfig, random: () => number): string | null {
  const hiddenPairs = [...new Set(board.map((card) => card.character))]
    .map((character) => board.filter((card) => card.character === character && card.status === 'hidden'))
    .filter((pair) => pair.length === 2)

  if (hiddenPairs.length < config.goldenEvent.minHiddenPairs) return null
  const pair = hiddenPairs[randomIndex(hiddenPairs.length, random)]
  return pair[randomIndex(pair.length, random)].id
}

function finishState(state: GameState, remainingMs: number): GameState {
  return {
    ...state,
    phase: 'finished',
    remainingMs,
    highScore: Math.max(state.highScore, state.score),
  }
}

function isGameConfig(value: GameConfig | GameSessionOptions): value is GameConfig {
  return 'session' in value && 'rounds' in value && 'scoring' in value && 'flow' in value && 'goldenEvent' in value
}

export function createGameSession(options?: GameSessionOptions): GameSession
export function createGameSession(config: GameConfig, runtimeOptions?: GameSessionRuntimeOptions): GameSession
export function createGameSession(
  configOrOptions: GameConfig | GameSessionOptions = {},
  runtimeOptions: GameSessionRuntimeOptions = {},
): GameSession {
  const config = isGameConfig(configOrOptions)
    ? configOrOptions
    : configOrOptions.config ?? DEFAULT_RESOLVED_GAME_CONFIG
  const options = isGameConfig(configOrOptions) ? runtimeOptions : configOrOptions
  const random = options.random ?? Math.random
  let state: GameState = {
    phase: 'ready',
    board: [],
    round: 1,
    score: 0,
    highScore: options.highScore ?? 0,
    remainingMs: config.session.durationMs,
    countdownMs: null,
    firstTurnHintMs: null,
    selectedCardIds: [],
    pendingResolutionMs: null,
    transitionRemainingMs: null,
    countdownTarget: null,
    pausedFrom: null,
    goldenEventStatus: 'unavailable',
    goldenScheduleMs: null,
    goldenAlertMs: null,
    goldenTimerMs: null,
    goldenCardId: null,
    goldenOutcome: null,
  }

  return {
    getState: () => state,
    getConfig: () => config,
    dispatch: (action) => {
      if (action.type === 'begin' && state.phase === 'ready') {
        const shouldScheduleGolden = config.goldenEvent.startRound <= 1
        const goldenEventStatus = shouldScheduleGolden
          ? state.remainingMs < config.goldenEvent.minRemainingMs
            ? 'cancelled'
            : 'scheduled'
          : 'unavailable'
        state = {
          ...state,
          phase: 'countdown',
          board: createBoard(1, config, random),
          countdownMs: config.flow.countdownMs,
          firstTurnHintMs: null,
          selectedCardIds: [],
          pendingResolutionMs: null,
          transitionRemainingMs: null,
          countdownTarget: 'first-turn-hint',
          pausedFrom: null,
          goldenEventStatus,
          goldenScheduleMs: goldenEventStatus === 'scheduled' ? getGoldenScheduleDelay(config, random) : null,
          goldenAlertMs: null,
          goldenTimerMs: null,
          goldenCardId: null,
          goldenOutcome: null,
        }
      }

      if (action.type === 'tick' && state.phase === 'countdown') {
        const countdownMs = Math.max(0, state.countdownMs! - action.deltaMs)
        const countdownTarget = state.countdownTarget!
        const phase = countdownMs === 0 ? countdownTarget : 'countdown'
        state = {
          ...state,
          phase,
          countdownMs: countdownMs === 0 ? null : countdownMs,
          firstTurnHintMs: phase === 'first-turn-hint' ? config.flow.firstTurnHintMs : state.firstTurnHintMs,
          countdownTarget: countdownMs === 0 ? null : state.countdownTarget,
          pausedFrom: countdownMs === 0 ? null : state.pausedFrom,
        }
        return state
      }

      if (action.type === 'tick' && state.phase === 'first-turn-hint') {
        const firstTurnHintMs = Math.max(0, state.firstTurnHintMs! - action.deltaMs)
        state = {
          ...state,
          phase: firstTurnHintMs === 0 ? 'playing' : 'first-turn-hint',
          firstTurnHintMs: firstTurnHintMs === 0 ? null : firstTurnHintMs,
        }
        return state
      }

      if (action.type === 'tick' && state.phase === 'playing') {
        const remainingMs = Math.max(0, state.remainingMs - action.deltaMs)
        let phase: GamePhase = remainingMs === 0 ? 'finished' : 'playing'
        let goldenEventStatus = state.goldenEventStatus
        let goldenScheduleMs = state.goldenScheduleMs
        let goldenAlertMs = state.goldenAlertMs
        let goldenCardId = state.goldenCardId
        if (phase === 'playing' && goldenEventStatus === 'scheduled' && goldenScheduleMs !== null) {
          goldenScheduleMs = Math.max(0, goldenScheduleMs - action.deltaMs)
          if (remainingMs < config.goldenEvent.minRemainingMs) {
            goldenEventStatus = 'cancelled'
            goldenScheduleMs = null
          } else if (goldenScheduleMs === 0 && state.selectedCardIds.length === 0) {
            goldenCardId = chooseGoldenCardId(state.board, config, random)
            if (goldenCardId) {
              phase = 'golden-alert'
              goldenEventStatus = 'alert'
              goldenScheduleMs = null
              goldenAlertMs = config.goldenEvent.alertMs
            } else {
              goldenEventStatus = 'scheduled'
              goldenScheduleMs = 0
            }
          }
        }
        state = {
          ...state,
          phase,
          remainingMs,
          goldenEventStatus,
          goldenScheduleMs,
          goldenAlertMs,
          goldenCardId,
          highScore: phase === 'finished' ? Math.max(state.highScore, state.score) : state.highScore,
        }
        return state
      }

      if (action.type === 'tick' && state.phase === 'golden-alert') {
        const goldenAlertMs = Math.max(0, state.goldenAlertMs! - action.deltaMs)
        state = {
          ...state,
          phase: goldenAlertMs === 0 ? 'golden-playing' : 'golden-alert',
          goldenEventStatus: goldenAlertMs === 0 ? 'active' : 'alert',
          goldenAlertMs: goldenAlertMs === 0 ? null : goldenAlertMs,
          goldenTimerMs: goldenAlertMs === 0 ? config.goldenEvent.timerMs : state.goldenTimerMs,
        }
        return state
      }

      if (action.type === 'tick' && state.phase === 'golden-playing') {
        const remainingMs = Math.max(0, state.remainingMs - action.deltaMs)
        const goldenTimerMs = Math.max(0, state.goldenTimerMs! - action.deltaMs)

        if (remainingMs === 0) {
          state = finishState(
            {
              ...state,
              goldenEventStatus: 'cancelled',
              goldenTimerMs: null,
              goldenCardId: null,
              selectedCardIds: [],
              board: state.board.map((card) =>
                state.selectedCardIds.includes(card.id) ? { ...card, status: 'hidden' as const } : card,
              ),
            },
            remainingMs,
          )
        } else if (goldenTimerMs === 0) {
          const penalizedRemainingMs = Math.max(0, remainingMs - config.goldenEvent.failureTimePenaltyMs)
          const failedState = {
            ...state,
            phase: penalizedRemainingMs === 0 ? ('finished' as const) : ('playing' as const),
            remainingMs: penalizedRemainingMs,
            goldenEventStatus: 'completed' as const,
            goldenTimerMs: null,
            goldenCardId: state.goldenCardId,
            goldenOutcome: 'failure' as const,
            selectedCardIds: [],
            board: state.board.map((card) =>
              state.selectedCardIds.includes(card.id) ? { ...card, status: 'hidden' as const } : card,
            ),
          }
          state = failedState.phase === 'finished' ? finishState(failedState, penalizedRemainingMs) : failedState
        } else {
          state = { ...state, remainingMs, goldenTimerMs }
        }
        return state
      }

      if (action.type === 'tick' && state.phase === 'resolving-mismatch') {
        const pendingResolutionMs = Math.max(0, state.pendingResolutionMs! - action.deltaMs)
        const remainingMs = Math.max(0, state.remainingMs - action.deltaMs)
        if (pendingResolutionMs > 0) {
          state = { ...state, pendingResolutionMs, remainingMs }
        } else {
          const selectedCardIds = new Set(state.selectedCardIds)
          const phase = remainingMs === 0 ? 'finished' : 'playing'
          state = {
            ...state,
            phase,
            board: state.board.map((card) =>
              selectedCardIds.has(card.id) ? { ...card, status: 'hidden' as const } : card,
            ),
            selectedCardIds: [],
            pendingResolutionMs: null,
            remainingMs,
            highScore: phase === 'finished' ? Math.max(state.highScore, state.score) : state.highScore,
          }
        }
        return state
      }

      if (action.type === 'tick' && state.phase === 'golden-resolving-mismatch') {
        const pendingResolutionMs = Math.max(0, state.pendingResolutionMs! - action.deltaMs)
        const remainingMs = Math.max(0, state.remainingMs - action.deltaMs)
        const selectedCardIds = new Set(state.selectedCardIds)
        if (remainingMs === 0) {
          state = finishState(
            {
              ...state,
              board: state.board.map((card) =>
                selectedCardIds.has(card.id) ? { ...card, status: 'hidden' as const } : card,
              ),
              selectedCardIds: [],
              pendingResolutionMs: null,
              goldenTimerMs: null,
            },
            remainingMs,
          )
        } else if (pendingResolutionMs > 0) {
          state = { ...state, pendingResolutionMs, remainingMs }
        } else {
          state = {
            ...state,
            phase: 'playing',
            board: state.board.map((card) =>
              selectedCardIds.has(card.id) ? { ...card, status: 'hidden' as const } : card,
            ),
            selectedCardIds: [],
            pendingResolutionMs: null,
            remainingMs,
            goldenTimerMs: null,
          }
        }
        return state
      }

      if (action.type === 'tick' && state.phase === 'transitioning-round') {
        const transitionRemainingMs = Math.max(0, state.transitionRemainingMs! - action.deltaMs)
        if (transitionRemainingMs > 0) {
          state = { ...state, transitionRemainingMs }
        } else {
          const round = state.round + 1
          const shouldScheduleGolden = round >= config.goldenEvent.startRound && state.goldenEventStatus === 'unavailable'
          const goldenEventStatus = shouldScheduleGolden
            ? state.remainingMs < config.goldenEvent.minRemainingMs
              ? 'cancelled'
              : 'scheduled'
            : state.goldenEventStatus
          state = {
            ...state,
            phase: 'playing',
            round,
            board: createBoard(round, config, random),
            selectedCardIds: [],
            transitionRemainingMs: null,
            goldenEventStatus,
            goldenScheduleMs: shouldScheduleGolden && goldenEventStatus === 'scheduled' ? getGoldenScheduleDelay(config, random) : state.goldenScheduleMs,
          }
        }
        return state
      }

      if (action.type === 'select-card' && (state.phase === 'playing' || state.phase === 'golden-playing')) {
        const selectedCard = state.board.find((card) => card.id === action.cardId)
        if (!selectedCard || selectedCard.status !== 'hidden') {
          return state
        }

        const isGoldenPlaying = state.phase === 'golden-playing' && state.goldenEventStatus === 'active'
        if (isGoldenPlaying && state.selectedCardIds.length === 0 && action.cardId !== state.goldenCardId) {
          return state
        }

        const boardWithSelection = state.board.map((card) =>
          card.id === action.cardId ? { ...card, status: 'revealed' as const } : card,
        )

        if (state.selectedCardIds.length === 0) {
          state = {
            ...state,
            board: boardWithSelection,
            selectedCardIds: [action.cardId],
          }
        } else {
          const firstCard = state.board.find((card) => card.id === state.selectedCardIds[0])!
          const isMatch = firstCard.character === selectedCard.character
          const selectedCardIds = [...state.selectedCardIds, action.cardId]
          const resolvedBoard = isMatch
            ? boardWithSelection.map((card) =>
                selectedCardIds.includes(card.id) ? { ...card, status: 'matched' as const } : card,
              )
            : boardWithSelection
          const boardIsComplete = isMatch && resolvedBoard.every((card) => card.status === 'matched')

          const isGoldenAttempt = isGoldenPlaying && state.selectedCardIds[0] === state.goldenCardId
          if (isGoldenAttempt && isMatch) {
            state = {
              ...state,
              board: resolvedBoard,
              score: state.score + config.scoring.matchScore + config.goldenEvent.successScoreBonus,
              remainingMs: state.remainingMs + config.goldenEvent.successTimeBonusMs,
              goldenEventStatus: 'completed',
              goldenTimerMs: null,
              goldenOutcome: 'success',
              selectedCardIds: [],
              phase: boardIsComplete ? 'transitioning-round' : 'playing',
              pendingResolutionMs: null,
              transitionRemainingMs: boardIsComplete ? config.flow.roundTransitionMs : null,
            }
          } else if (isGoldenAttempt) {
            const remainingMs = Math.max(0, state.remainingMs - config.goldenEvent.failureTimePenaltyMs)
            const failedState = {
              ...state,
              board: resolvedBoard,
              remainingMs,
              goldenEventStatus: 'completed' as const,
              goldenTimerMs: null,
              goldenOutcome: 'failure' as const,
              selectedCardIds,
              phase: remainingMs === 0 ? ('finished' as const) : ('golden-resolving-mismatch' as const),
              pendingResolutionMs: remainingMs === 0 ? null : config.flow.mismatchRevealMs,
              transitionRemainingMs: null,
            }
            state = remainingMs === 0 ? finishState({ ...failedState, selectedCardIds: [] }, remainingMs) : failedState
          } else {
            state = {
              ...state,
              board: resolvedBoard,
              score: isMatch
                ? state.score + config.scoring.matchScore
                : Math.max(0, state.score - config.scoring.mismatchPenalty),
              selectedCardIds: isMatch ? [] : selectedCardIds,
              phase: boardIsComplete ? 'transitioning-round' : isMatch ? 'playing' : 'resolving-mismatch',
              pendingResolutionMs: isMatch ? null : config.flow.mismatchRevealMs,
              transitionRemainingMs: boardIsComplete ? config.flow.roundTransitionMs : null,
            }
          }
        }
      }

      if (action.type === 'pause' && isClockRunningPhase(state.phase)) {
        state = {
          ...state,
          phase: 'paused',
          pausedFrom: state.phase,
        }
      }

      if (action.type === 'resume' && state.phase === 'paused' && state.pausedFrom) {
        const countdownTarget =
          state.pausedFrom === 'countdown'
            ? state.countdownTarget ?? 'playing'
            : state.pausedFrom === 'first-turn-hint'
              ? 'playing'
              : state.pausedFrom
        state = {
          ...state,
          phase: 'countdown',
          countdownMs: config.flow.countdownMs,
          firstTurnHintMs: null,
          countdownTarget,
        }
      }

      return state
    },
  }
}
