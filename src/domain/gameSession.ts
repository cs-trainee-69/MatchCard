export const GAME_DURATION_MS = 120_000
export const ROUND_LAYOUTS = [
  { rows: 2, columns: 2, cardCount: 4 },
  { rows: 2, columns: 3, cardCount: 6 },
  { rows: 2, columns: 4, cardCount: 8 },
  { rows: 3, columns: 4, cardCount: 12 },
  { rows: 4, columns: 4, cardCount: 16 },
] as const

export const ROUND_CARD_COUNTS = [4, 6, 8, 12, 16] as const

export type BoardSize = (typeof ROUND_LAYOUTS)[number]['cardCount']
export type BoardLayout = (typeof ROUND_LAYOUTS)[number]
export type CatCharacterId =
  | 'alien'
  | 'cowboy'
  | 'doctor'
  | 'fish'
  | 'griffin'
  | 'octopus'
  | 'police'
  | 'space'
  | 'witch'

export type GamePhase =
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'resolving-mismatch'
  | 'transitioning-round'
  | 'paused'
  | 'finished'

type ResumablePhase = 'playing' | 'resolving-mismatch' | 'transitioning-round'
type PausablePhase = ResumablePhase | 'countdown'

export type Card = {
  id: string
  character: CatCharacterId
  status: 'hidden' | 'revealed' | 'matched'
}

export type GameState = {
  phase: GamePhase
  board: Card[]
  round: number
  score: number
  highScore: number
  remainingMs: number
  countdownMs: number | null
  selectedCardIds: string[]
  pendingResolutionMs: number | null
  transitionRemainingMs: number | null
  countdownTarget: ResumablePhase | null
  pausedFrom: PausablePhase | null
}

export type GameAction =
  | { type: 'begin' }
  | { type: 'tick'; deltaMs: number }
  | { type: 'select-card'; cardId: string }
  | { type: 'pause' }
  | { type: 'resume' }

export type GameSessionOptions = {
  durationMs?: number
  random?: () => number
  highScore?: number
}

export type GameSession = {
  getState: () => GameState
  dispatch: (action: GameAction) => GameState
}

const CAT_CHARACTERS: CatCharacterId[] = [
  'alien',
  'cowboy',
  'doctor',
  'fish',
  'griffin',
  'octopus',
  'police',
  'space',
  'witch',
]

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

export function getBoardLayout(round: number): BoardLayout {
  const roundIndex = Math.min(Math.max(Math.floor(round), 1) - 1, ROUND_LAYOUTS.length - 1)
  return ROUND_LAYOUTS[roundIndex]
}

function createBoard(round: number, random: () => number): Card[] {
  const boardSize = getBoardLayout(round).cardCount
  const characterCount = boardSize / 2
  const characters = shuffle(CAT_CHARACTERS, random)

  const cards = characters.slice(0, characterCount).flatMap((character, characterIndex) => [
    { id: `${round}-${characterIndex}-a`, character, status: 'hidden' as const },
    { id: `${round}-${characterIndex}-b`, character, status: 'hidden' as const },
  ])

  return shuffle(cards, random)
}

export function createGameSession(options: GameSessionOptions = {}): GameSession {
  const durationMs = options.durationMs ?? GAME_DURATION_MS
  const random = options.random ?? Math.random
  let state: GameState = {
    phase: 'ready',
    board: [],
    round: 1,
    score: 0,
    highScore: options.highScore ?? 0,
    remainingMs: durationMs,
    countdownMs: null,
    selectedCardIds: [],
    pendingResolutionMs: null,
    transitionRemainingMs: null,
    countdownTarget: null,
    pausedFrom: null,
  }

  return {
    getState: () => state,
    dispatch: (action) => {
      if (action.type === 'begin' && state.phase === 'ready') {
        state = {
          ...state,
          phase: 'countdown',
          board: createBoard(1, random),
          countdownMs: 3_000,
          selectedCardIds: [],
          pendingResolutionMs: null,
          transitionRemainingMs: null,
          countdownTarget: 'playing',
          pausedFrom: null,
        }
      }

      if (action.type === 'tick' && state.phase === 'countdown') {
        const countdownMs = Math.max(0, state.countdownMs! - action.deltaMs)
        state = {
          ...state,
          phase: countdownMs === 0 ? state.countdownTarget! : 'countdown',
          countdownMs: countdownMs === 0 ? null : countdownMs,
          countdownTarget: countdownMs === 0 ? null : state.countdownTarget,
          pausedFrom: countdownMs === 0 ? null : state.pausedFrom,
        }
        return state
      }

      if (action.type === 'tick' && state.phase === 'playing') {
        const remainingMs = Math.max(0, state.remainingMs - action.deltaMs)
        state = {
          ...state,
          phase: remainingMs === 0 ? 'finished' : 'playing',
          remainingMs,
          highScore: remainingMs === 0 ? Math.max(state.highScore, state.score) : state.highScore,
        }
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
      }

      if (action.type === 'tick' && state.phase === 'transitioning-round') {
        const transitionRemainingMs = Math.max(0, state.transitionRemainingMs! - action.deltaMs)
        if (transitionRemainingMs > 0) {
          state = { ...state, transitionRemainingMs }
        } else {
          const round = state.round + 1
          state = {
            ...state,
            phase: 'playing',
            round,
            board: createBoard(round, random),
            selectedCardIds: [],
            transitionRemainingMs: null,
          }
        }
      }

      if (action.type === 'select-card' && state.phase === 'playing') {
        const selectedCard = state.board.find((card) => card.id === action.cardId)
        if (!selectedCard || selectedCard.status !== 'hidden') {
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

          state = {
            ...state,
            board: resolvedBoard,
            score: isMatch ? state.score + 10 : Math.max(0, state.score - 1),
            selectedCardIds: isMatch ? [] : selectedCardIds,
            phase: boardIsComplete ? 'transitioning-round' : isMatch ? 'playing' : 'resolving-mismatch',
            pendingResolutionMs: isMatch ? null : 700,
            transitionRemainingMs: boardIsComplete ? 800 : null,
          }
        }
      }

      if (
        action.type === 'pause' &&
        (state.phase === 'countdown' ||
          state.phase === 'playing' ||
          state.phase === 'resolving-mismatch' ||
          state.phase === 'transitioning-round')
      ) {
        state = {
          ...state,
          phase: 'paused',
          pausedFrom: state.phase,
        }
      }

      if (action.type === 'resume' && state.phase === 'paused' && state.pausedFrom) {
        state = {
          ...state,
          phase: 'countdown',
          countdownMs: 3_000,
          countdownTarget: state.pausedFrom === 'countdown' ? 'playing' : state.pausedFrom,
        }
      }

      return state
    },
  }
}
