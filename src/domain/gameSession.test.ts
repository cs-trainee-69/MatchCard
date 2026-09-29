import { describe, expect, it } from 'vitest'
import { createGameSession, getBoardLayout, type GameSession } from './gameSession'

function startPlaying(session: GameSession) {
  session.dispatch({ type: 'begin' })
  session.dispatch({ type: 'tick', deltaMs: 3000 })
  session.dispatch({ type: 'tick', deltaMs: 1200 })
}

function completeCurrentBoard(session: GameSession) {
  const characters = [...new Set(session.getState().board.map((card) => card.character))]
  for (const character of characters) {
    const pair = session.getState().board.filter((card) => card.character === character)
    session.dispatch({ type: 'select-card', cardId: pair[0].id })
    session.dispatch({ type: 'select-card', cardId: pair[1].id })
  }
  session.dispatch({ type: 'tick', deltaMs: 800 })
}

function advanceToRoundThree(session: GameSession) {
  startPlaying(session)
  completeCurrentBoard(session)
  completeCurrentBoard(session)
}

function startGoldenEvent(session: GameSession) {
  advanceToRoundThree(session)
  session.dispatch({ type: 'tick', deltaMs: 3000 })
  session.dispatch({ type: 'tick', deltaMs: 2500 })
}

describe('Board layout', () => {
  it('uses the requested rows by columns layout for each round', () => {
    const layouts = [1, 2, 3, 4, 5, 6, 7].map((round) => {
      const { rows, columns } = getBoardLayout(round)
      return `${rows}x${columns}`
    })

    expect(layouts).toEqual(['2x2', '3x2', '4x2', '4x3', '4x4', '5x4', '5x4'])
  })
})

describe('Game Session start', () => {
  it('starts with a four-card Board and does not spend time during countdown', () => {
    const session = createGameSession({ random: () => 0 })

    expect(session.getState().phase).toBe('ready')

    session.dispatch({ type: 'begin' })
    expect(session.getState().phase).toBe('countdown')
    expect(session.getState().countdownMs).toBe(3000)
    expect(session.getState().remainingMs).toBe(120000)
    expect(session.getState().board).toHaveLength(4)

    session.dispatch({ type: 'tick', deltaMs: 3000 })
    expect(session.getState().phase).toBe('first-turn-hint')
    expect(session.getState().firstTurnHintMs).toBe(1200)
    expect(session.getState().remainingMs).toBe(120000)

    session.dispatch({ type: 'tick', deltaMs: 1200 })
    expect(session.getState().phase).toBe('playing')
    expect(session.getState().remainingMs).toBe(120000)
  })

  it('shows the First-Turn Hint once and locks cards until it ends', () => {
    const session = createGameSession({ random: () => 0 })
    session.dispatch({ type: 'begin' })
    session.dispatch({ type: 'tick', deltaMs: 3000 })

    expect(session.getState().phase).toBe('first-turn-hint')
    expect(session.getState().remainingMs).toBe(120000)
    session.dispatch({ type: 'select-card', cardId: session.getState().board[0].id })
    expect(session.getState().selectedCardIds).toEqual([])

    session.dispatch({ type: 'tick', deltaMs: 1199 })
    expect(session.getState().phase).toBe('first-turn-hint')
    expect(session.getState().firstTurnHintMs).toBe(1)
    session.dispatch({ type: 'tick', deltaMs: 1 })
    expect(session.getState().phase).toBe('playing')
    expect(session.getState().firstTurnHintMs).toBeNull()
    expect(session.getState().remainingMs).toBe(120000)
  })

  it('awards 10 Score and locks a matched pair on the Board', () => {
    const session = createGameSession({ random: () => 0 })
    startPlaying(session)

    const firstCard = session.getState().board[0]
    const matchingCard = session.getState().board.find(
      (card) => card.id !== firstCard.id && card.character === firstCard.character,
    )!

    session.dispatch({ type: 'select-card', cardId: firstCard.id })
    session.dispatch({ type: 'select-card', cardId: matchingCard.id })

    const state = session.getState()
    expect(state.phase).toBe('playing')
    expect(state.score).toBe(10)
    expect(state.selectedCardIds).toEqual([])
    expect(state.board.filter((card) => card.character === firstCard.character)).toEqual([
      expect.objectContaining({ status: 'matched' }),
      expect.objectContaining({ status: 'matched' }),
    ])
  })

  it('deducts 1 Score and briefly reveals a Mismatch before turning it back', () => {
    const session = createGameSession({ random: () => 0 })
    startPlaying(session)

    const [firstCard, secondCard] = session.getState().board
    expect(firstCard.character).not.toBe(secondCard.character)

    session.dispatch({ type: 'select-card', cardId: firstCard.id })
    session.dispatch({ type: 'select-card', cardId: secondCard.id })

    expect(session.getState().phase).toBe('resolving-mismatch')
    expect(session.getState().score).toBe(0)
    expect(session.getState().selectedCardIds).toEqual([firstCard.id, secondCard.id])
    expect(session.getState().board.slice(0, 2)).toEqual([
      expect.objectContaining({ status: 'revealed' }),
      expect.objectContaining({ status: 'revealed' }),
    ])

    session.dispatch({ type: 'select-card', cardId: session.getState().board[2].id })
    expect(session.getState().selectedCardIds).toEqual([firstCard.id, secondCard.id])

    session.dispatch({ type: 'tick', deltaMs: 699 })
    expect(session.getState().phase).toBe('resolving-mismatch')
    session.dispatch({ type: 'tick', deltaMs: 1 })

    expect(session.getState().phase).toBe('playing')
    expect(session.getState().selectedCardIds).toEqual([])
    expect(session.getState().board.slice(0, 2)).toEqual([
      expect.objectContaining({ status: 'hidden' }),
      expect.objectContaining({ status: 'hidden' }),
    ])
  })

  it('deducts one Score from a positive total for a Mismatch', () => {
    const session = createGameSession({ random: () => 0 })
    startPlaying(session)
    const characters = [...new Set(session.getState().board.map((card) => card.character))]
    const firstPair = session.getState().board.filter((card) => card.character === characters[0])
    session.dispatch({ type: 'select-card', cardId: firstPair[0].id })
    session.dispatch({ type: 'select-card', cardId: firstPair[1].id })
    const secondPair = session.getState().board.filter((card) => card.character === characters[1])
    session.dispatch({ type: 'select-card', cardId: secondPair[0].id })
    session.dispatch({ type: 'select-card', cardId: secondPair[1].id })

    session.dispatch({ type: 'tick', deltaMs: 800 })
    const mismatchFirst = session.getState().board[0]
    const mismatchSecond = session.getState().board.find((card) => card.character !== mismatchFirst.character)!
    session.dispatch({ type: 'select-card', cardId: mismatchFirst.id })
    session.dispatch({ type: 'select-card', cardId: mismatchSecond.id })
    expect(session.getState().score).toBe(19)
  })

  it('continues counting down while a Mismatch is being revealed', () => {
    const session = createGameSession({ durationMs: 1000, random: () => 0 })
    startPlaying(session)
    const [firstCard, secondCard] = session.getState().board

    session.dispatch({ type: 'select-card', cardId: firstCard.id })
    session.dispatch({ type: 'select-card', cardId: secondCard.id })
    session.dispatch({ type: 'tick', deltaMs: 400 })

    expect(session.getState().remainingMs).toBe(600)
    expect(session.getState().pendingResolutionMs).toBe(300)

    session.dispatch({ type: 'tick', deltaMs: 300 })
    expect(session.getState().phase).toBe('playing')
    expect(session.getState().remainingMs).toBe(300)
  })

  it('advances to the next Board after every pair in the current Board is matched', () => {
    const session = createGameSession({ random: () => 0 })
    startPlaying(session)

    const pairs = [...new Set(session.getState().board.map((card) => card.character))]
    for (const character of pairs) {
      const pair = session.getState().board.filter((card) => card.character === character)
      session.dispatch({ type: 'select-card', cardId: pair[0].id })
      session.dispatch({ type: 'select-card', cardId: pair[1].id })
    }

    expect(session.getState().phase).toBe('transitioning-round')
    expect(session.getState().transitionRemainingMs).toBe(800)
    expect(session.getState().round).toBe(1)

    session.dispatch({ type: 'tick', deltaMs: 799 })
    expect(session.getState().phase).toBe('transitioning-round')
    session.dispatch({ type: 'tick', deltaMs: 1 })

    expect(session.getState().phase).toBe('playing')
    expect(session.getState().round).toBe(2)
    expect(session.getState().board).toHaveLength(6)
    expect(session.getState().board.every((card) => card.status === 'hidden')).toBe(true)
  })

  it('finishes the Game Session at zero and preserves the best High Score', () => {
    const session = createGameSession({ durationMs: 1000, highScore: 7, random: () => 0 })
    startPlaying(session)
    session.dispatch({ type: 'tick', deltaMs: 999 })

    expect(session.getState().phase).toBe('playing')
    expect(session.getState().remainingMs).toBe(1)

    session.dispatch({ type: 'tick', deltaMs: 1 })

    expect(session.getState().phase).toBe('finished')
    expect(session.getState().remainingMs).toBe(0)
    expect(session.getState().highScore).toBe(7)
  })

  it('resolves a second-card Mismatch accepted before zero before finishing', () => {
    const session = createGameSession({ durationMs: 1, random: () => 0 })
    startPlaying(session)
    const [firstCard, secondCard] = session.getState().board

    session.dispatch({ type: 'select-card', cardId: firstCard.id })
    session.dispatch({ type: 'select-card', cardId: secondCard.id })
    expect(session.getState().phase).toBe('resolving-mismatch')
    expect(session.getState().remainingMs).toBe(1)

    session.dispatch({ type: 'tick', deltaMs: 700 })
    expect(session.getState().phase).toBe('finished')
    expect(session.getState().remainingMs).toBe(0)
    expect(session.getState().selectedCardIds).toEqual([])
  })

  it('updates High Score when the finished Score beats the saved value', () => {
    const session = createGameSession({ durationMs: 1000, highScore: 7, random: () => 0 })
    startPlaying(session)
    const [firstCard, matchingCard] = session.getState().board.filter(
      (card, _, board) => card.character === board[0].character,
    )
    session.dispatch({ type: 'select-card', cardId: firstCard.id })
    session.dispatch({ type: 'select-card', cardId: matchingCard.id })
    session.dispatch({ type: 'tick', deltaMs: 1000 })

    expect(session.getState().score).toBe(10)
    expect(session.getState().phase).toBe('finished')
    expect(session.getState().highScore).toBe(10)
  })

  it('caps Board size at twenty cards while continuing to increase the Round number', () => {
    const session = createGameSession({ random: () => 0 })
    startPlaying(session)
    const expectedSizes = [4, 6, 8, 12, 16, 20]

    for (const expectedSize of expectedSizes) {
      expect(session.getState().board).toHaveLength(expectedSize)
      const counts = new Map<string, number>()
      for (const card of session.getState().board) counts.set(card.character, (counts.get(card.character) ?? 0) + 1)
      expect([...counts.values()].every((count) => count === 2)).toBe(true)
      const characters = [...counts.keys()]
      for (const character of characters) {
        const pair = session.getState().board.filter((card) => card.character === character)
        session.dispatch({ type: 'select-card', cardId: pair[0].id })
        session.dispatch({ type: 'select-card', cardId: pair[1].id })
      }
      session.dispatch({ type: 'tick', deltaMs: 800 })
    }

    expect(session.getState().round).toBe(7)
    expect(session.getState().board).toHaveLength(20)
    expect(session.getState().board.every((card) => card.status === 'hidden')).toBe(true)
  })

  it('pauses active play and resumes with a fresh countdown without spending time', () => {
    const session = createGameSession({ random: () => 0 })
    startPlaying(session)
    const firstCard = session.getState().board[0]
    session.dispatch({ type: 'select-card', cardId: firstCard.id })
    session.dispatch({ type: 'tick', deltaMs: 500 })
    const remainingBeforePause = session.getState().remainingMs

    session.dispatch({ type: 'pause' })
    session.dispatch({ type: 'tick', deltaMs: 5000 })
    expect(session.getState().phase).toBe('paused')
    expect(session.getState().remainingMs).toBe(remainingBeforePause)

    session.dispatch({ type: 'resume' })
    expect(session.getState().phase).toBe('countdown')
    expect(session.getState().countdownMs).toBe(3000)
    session.dispatch({ type: 'tick', deltaMs: 3000 })

    expect(session.getState().phase).toBe('playing')
    expect(session.getState().remainingMs).toBe(remainingBeforePause)
    expect(session.getState().selectedCardIds).toEqual([firstCard.id])
  })

  it('restarts the countdown if the document is hidden during the initial countdown', () => {
    const session = createGameSession({ random: () => 0 })
    session.dispatch({ type: 'begin' })
    session.dispatch({ type: 'tick', deltaMs: 1000 })
    session.dispatch({ type: 'pause' })
    session.dispatch({ type: 'tick', deltaMs: 5000 })

    expect(session.getState().phase).toBe('paused')
    expect(session.getState().countdownMs).toBe(2000)

    session.dispatch({ type: 'resume' })
    expect(session.getState().countdownMs).toBe(3000)
    session.dispatch({ type: 'tick', deltaMs: 3000 })
    expect(session.getState().phase).toBe('first-turn-hint')
    session.dispatch({ type: 'tick', deltaMs: 1200 })
    expect(session.getState().phase).toBe('playing')
    expect(session.getState().remainingMs).toBe(120000)
  })

  it('does not repeat the First-Turn Hint after resuming active play', () => {
    const session = createGameSession({ random: () => 0 })
    startPlaying(session)

    session.dispatch({ type: 'pause' })
    session.dispatch({ type: 'resume' })
    expect(session.getState().phase).toBe('countdown')
    session.dispatch({ type: 'tick', deltaMs: 3000 })

    expect(session.getState().phase).toBe('playing')
    expect(session.getState().firstTurnHintMs).toBeNull()
    expect(session.getState().remainingMs).toBe(120000)
  })

  it('does not repeat the First-Turn Hint after pausing during the Hint', () => {
    const session = createGameSession({ random: () => 0 })
    session.dispatch({ type: 'begin' })
    session.dispatch({ type: 'tick', deltaMs: 3000 })
    session.dispatch({ type: 'pause' })
    session.dispatch({ type: 'resume' })

    expect(session.getState().phase).toBe('countdown')
    session.dispatch({ type: 'tick', deltaMs: 3000 })

    expect(session.getState().phase).toBe('playing')
    expect(session.getState().firstTurnHintMs).toBeNull()
    expect(session.getState().remainingMs).toBe(120000)
  })
})

describe('Golden Card Event', () => {
  it('schedules once on Round 3 and starts after its active-play delay', () => {
    const session = createGameSession({ random: () => 0 })
    advanceToRoundThree(session)

    expect(session.getState().round).toBe(3)
    expect(session.getState().goldenEventStatus).toBe('scheduled')
    expect(session.getState().goldenScheduleMs).toBe(3000)

    session.dispatch({ type: 'tick', deltaMs: 2999 })
    expect(session.getState().phase).toBe('playing')
    expect(session.getState().goldenEventStatus).toBe('scheduled')

    session.dispatch({ type: 'tick', deltaMs: 1 })
    expect(session.getState().phase).toBe('golden-alert')
    expect(session.getState().goldenEventStatus).toBe('alert')
    expect(session.getState().goldenAlertMs).toBe(2500)
    expect(session.getState().goldenCardId).not.toBeNull()
  })

  it('pauses the main clock during the Alert and then starts a five-second Golden Timer', () => {
    const session = createGameSession({ random: () => 0 })
    advanceToRoundThree(session)
    const remainingBeforeAlert = session.getState().remainingMs

    session.dispatch({ type: 'tick', deltaMs: 3000 })
    expect(session.getState().remainingMs).toBe(remainingBeforeAlert - 3000)
    session.dispatch({ type: 'tick', deltaMs: 1200 })
    expect(session.getState().remainingMs).toBe(remainingBeforeAlert - 3000)
    expect(session.getState().phase).toBe('golden-alert')

    session.dispatch({ type: 'tick', deltaMs: 1300 })
    expect(session.getState().phase).toBe('golden-playing')
    expect(session.getState().goldenTimerMs).toBe(5000)
    expect(session.getState().remainingMs).toBe(remainingBeforeAlert - 3000)
  })

  it('defers activation until a pending Card selection is resolved', () => {
    const session = createGameSession({ random: () => 0 })
    advanceToRoundThree(session)
    session.dispatch({ type: 'tick', deltaMs: 2999 })
    const firstCard = session.getState().board[0]
    const matchingCard = session.getState().board.find(
      (card) => card.id !== firstCard.id && card.character === firstCard.character,
    )!

    session.dispatch({ type: 'select-card', cardId: firstCard.id })
    session.dispatch({ type: 'tick', deltaMs: 1 })
    expect(session.getState().phase).toBe('playing')
    expect(session.getState().goldenEventStatus).toBe('scheduled')
    expect(session.getState().goldenScheduleMs).toBe(0)

    session.dispatch({ type: 'select-card', cardId: matchingCard.id })
    session.dispatch({ type: 'tick', deltaMs: 1 })
    expect(session.getState().phase).toBe('golden-alert')
    expect(session.getState().goldenEventStatus).toBe('alert')
  })

  it('reveals the Golden Card and awards the normal Match plus its bonus', () => {
    const session = createGameSession({ random: () => 0 })
    startGoldenEvent(session)
    const stateBeforeMatch = session.getState()
    const goldenCard = stateBeforeMatch.board.find((card) => card.id === stateBeforeMatch.goldenCardId)!
    const matchingCard = stateBeforeMatch.board.find(
      (card) => card.id !== goldenCard.id && card.character === goldenCard.character,
    )!

    session.dispatch({ type: 'select-card', cardId: goldenCard.id })
    expect(session.getState().selectedCardIds).toEqual([goldenCard.id])
    session.dispatch({ type: 'select-card', cardId: matchingCard.id })

    const state = session.getState()
    expect(state.score).toBe(stateBeforeMatch.score + 15)
    expect(state.remainingMs).toBe(stateBeforeMatch.remainingMs + 5000)
    expect(state.remainingMs).toBeGreaterThan(120000)
    expect(state.goldenEventStatus).toBe('completed')
    expect(state.goldenOutcome).toBe('success')
    expect(state.goldenTimerMs).toBeNull()
    expect(state.selectedCardIds).toEqual([])
    expect(state.board.filter((card) => card.character === goldenCard.character)).toEqual([
      expect.objectContaining({ status: 'matched' }),
      expect.objectContaining({ status: 'matched' }),
    ])
  })

  it('fails immediately on a wrong Card and deducts five seconds without Score loss', () => {
    const session = createGameSession({ random: () => 0 })
    startGoldenEvent(session)
    const stateBeforeMatch = session.getState()
    const goldenCard = stateBeforeMatch.board.find((card) => card.id === stateBeforeMatch.goldenCardId)!
    const wrongCard = stateBeforeMatch.board.find((card) => card.character !== goldenCard.character)!

    session.dispatch({ type: 'select-card', cardId: goldenCard.id })
    session.dispatch({ type: 'select-card', cardId: wrongCard.id })

    expect(session.getState().phase).toBe('golden-resolving-mismatch')
    expect(session.getState().score).toBe(stateBeforeMatch.score)
    expect(session.getState().remainingMs).toBe(stateBeforeMatch.remainingMs - 5000)
    expect(session.getState().goldenOutcome).toBe('failure')

    session.dispatch({ type: 'tick', deltaMs: 700 })
    expect(session.getState().phase).toBe('playing')
    expect(session.getState().goldenEventStatus).toBe('completed')
    expect(session.getState().selectedCardIds).toEqual([])
  })

  it('fails when the Golden Timer expires and returns the Card to the normal Board', () => {
    const session = createGameSession({ random: () => 0 })
    startGoldenEvent(session)
    const stateBeforeTimeout = session.getState()

    session.dispatch({ type: 'tick', deltaMs: 5000 })

    const state = session.getState()
    expect(state.phase).toBe('playing')
    expect(state.remainingMs).toBe(stateBeforeTimeout.remainingMs - 5000 - 5000)
    expect(state.goldenEventStatus).toBe('completed')
    expect(state.goldenOutcome).toBe('failure')
    expect(state.goldenTimerMs).toBeNull()
    expect(state.board.every((card) => card.status === 'hidden')).toBe(true)
  })

  it('preserves Golden Card Event timing through pause and resume', () => {
    const session = createGameSession({ random: () => 0 })
    startGoldenEvent(session)
    session.dispatch({ type: 'tick', deltaMs: 1000 })
    const beforePause = session.getState()

    session.dispatch({ type: 'pause' })
    expect(session.getState().phase).toBe('paused')
    session.dispatch({ type: 'tick', deltaMs: 5000 })
    expect(session.getState().remainingMs).toBe(beforePause.remainingMs)
    expect(session.getState().goldenTimerMs).toBe(beforePause.goldenTimerMs)

    session.dispatch({ type: 'resume' })
    expect(session.getState().phase).toBe('countdown')
    session.dispatch({ type: 'tick', deltaMs: 3000 })
    expect(session.getState().phase).toBe('golden-playing')
    expect(session.getState().remainingMs).toBe(beforePause.remainingMs)
    expect(session.getState().goldenTimerMs).toBe(beforePause.goldenTimerMs)
  })

  it('pauses and resumes the Alert without spending Golden or Game Session time', () => {
    const session = createGameSession({ random: () => 0 })
    advanceToRoundThree(session)
    session.dispatch({ type: 'tick', deltaMs: 3000 })
    const beforePause = session.getState()

    session.dispatch({ type: 'pause' })
    session.dispatch({ type: 'tick', deltaMs: 5000 })
    expect(session.getState().phase).toBe('paused')
    expect(session.getState().remainingMs).toBe(beforePause.remainingMs)
    expect(session.getState().goldenAlertMs).toBe(beforePause.goldenAlertMs)

    session.dispatch({ type: 'resume' })
    session.dispatch({ type: 'tick', deltaMs: 3000 })
    expect(session.getState().phase).toBe('golden-alert')
    expect(session.getState().goldenAlertMs).toBe(beforePause.goldenAlertMs)
    session.dispatch({ type: 'tick', deltaMs: 2500 })
    expect(session.getState().phase).toBe('golden-playing')
  })

  it('carries an unstarted Golden Card Event into the next Round and never repeats it after completion', () => {
    const session = createGameSession({ random: () => 0 })
    advanceToRoundThree(session)
    completeCurrentBoard(session)
    expect(session.getState().round).toBe(4)
    expect(session.getState().goldenEventStatus).toBe('scheduled')
    expect(session.getState().goldenScheduleMs).toBe(3000)

    session.dispatch({ type: 'tick', deltaMs: 3000 })
    expect(session.getState().phase).toBe('golden-alert')
    session.dispatch({ type: 'tick', deltaMs: 2500 })
    const stateBeforeMatch = session.getState()
    const goldenCard = stateBeforeMatch.board.find((card) => card.id === stateBeforeMatch.goldenCardId)!
    const matchingCard = stateBeforeMatch.board.find(
      (card) => card.id !== goldenCard.id && card.character === goldenCard.character,
    )!
    session.dispatch({ type: 'select-card', cardId: goldenCard.id })
    session.dispatch({ type: 'select-card', cardId: matchingCard.id })

    expect(session.getState().goldenEventStatus).toBe('completed')
    completeCurrentBoard(session)
    expect(session.getState().goldenEventStatus).toBe('completed')
  })

  it('transitions the Board after a Golden Match completes the final hidden pair', () => {
    const session = createGameSession({ random: () => 0 })
    advanceToRoundThree(session)
    const characters = [...new Set(session.getState().board.map((card) => card.character))]
    for (const character of characters.slice(0, -1)) {
      const pair = session.getState().board.filter((card) => card.character === character)
      session.dispatch({ type: 'select-card', cardId: pair[0].id })
      session.dispatch({ type: 'select-card', cardId: pair[1].id })
    }

    session.dispatch({ type: 'tick', deltaMs: 3000 })
    session.dispatch({ type: 'tick', deltaMs: 2500 })
    const stateBeforeMatch = session.getState()
    const goldenCard = stateBeforeMatch.board.find((card) => card.id === stateBeforeMatch.goldenCardId)!
    const matchingCard = stateBeforeMatch.board.find(
      (card) => card.id !== goldenCard.id && card.character === goldenCard.character,
    )!
    session.dispatch({ type: 'select-card', cardId: goldenCard.id })
    session.dispatch({ type: 'select-card', cardId: matchingCard.id })

    expect(session.getState().phase).toBe('transitioning-round')
    expect(session.getState().transitionRemainingMs).toBe(800)
    expect(session.getState().score).toBe(stateBeforeMatch.score + 15)
    session.dispatch({ type: 'tick', deltaMs: 800 })
    expect(session.getState().phase).toBe('playing')
    expect(session.getState().round).toBe(4)
  })

  it('finishes without an extra Golden penalty when the main clock reaches zero first', () => {
    const session = createGameSession({ durationMs: 30_000, random: () => 0 })
    advanceToRoundThree(session)
    session.dispatch({ type: 'tick', deltaMs: 3000 })
    session.dispatch({ type: 'tick', deltaMs: 2500 })
    session.dispatch({ type: 'tick', deltaMs: 30_000 })

    expect(session.getState().phase).toBe('finished')
    expect(session.getState().remainingMs).toBe(0)
    expect(session.getState().goldenOutcome).toBeNull()
    expect(session.getState().score).toBe(50)
  })

  it('clamps the failure penalty when the Golden Timer expires near zero', () => {
    const session = createGameSession({ durationMs: 30_000, random: () => 0 })
    advanceToRoundThree(session)
    session.dispatch({ type: 'tick', deltaMs: 3000 })
    session.dispatch({ type: 'tick', deltaMs: 2500 })
    session.dispatch({ type: 'tick', deltaMs: 23_000 })

    expect(session.getState().phase).toBe('finished')
    expect(session.getState().remainingMs).toBe(0)
    expect(session.getState().goldenOutcome).toBe('failure')
  })

  it('cancels the pending Golden Card Event if the Game Session reaches Round 3 too late', () => {
    const session = createGameSession({ durationMs: 19_000, random: () => 0 })
    advanceToRoundThree(session)

    expect(session.getState().round).toBe(3)
    expect(session.getState().goldenEventStatus).toBe('cancelled')
    expect(session.getState().goldenScheduleMs).toBeNull()
  })
})
