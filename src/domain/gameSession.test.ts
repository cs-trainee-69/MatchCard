import { describe, expect, it } from 'vitest'
import { createGameSession, getBoardLayout, type GameSession } from './gameSession'

function startPlaying(session: GameSession) {
  session.dispatch({ type: 'begin' })
  session.dispatch({ type: 'tick', deltaMs: 3000 })
  session.dispatch({ type: 'tick', deltaMs: 1200 })
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
