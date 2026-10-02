/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelDelayedSounds, playSound } from './audio'
import App from './App'
import { createGameConfig } from './domain/gameConfig'

vi.mock('./audio', () => ({ cancelDelayedSounds: vi.fn(), playSound: vi.fn() }))

describe('App with an active Game Config', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(playSound).mockClear()
    vi.mocked(cancelDelayedSounds).mockClear()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('uses the active config for Board layout, Golden Timer, and rule-dependent copy', () => {
    const config = createGameConfig({
      rounds: { layouts: [{ rows: 3, columns: 2, cardCount: 6 }] },
      flow: { countdownMs: 0, firstTurnHintMs: 0 },
      goldenEvent: {
        startRound: 1,
        scheduleDelayMinMs: 0,
        scheduleDelayMaxMs: 0,
        minRemainingMs: 0,
        alertMs: 0,
        timerMs: 2_500,
      },
    })

    render(<App config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'แตะเพื่อเริ่ม' }))

    act(() => vi.advanceTimersByTime(100))
    act(() => vi.advanceTimersByTime(100))
    act(() => vi.advanceTimersByTime(100))

    expect(screen.queryByTestId('golden-alert')).toBeNull()
    const cards = [...document.querySelectorAll<HTMLButtonElement>('button.card-button')]
    const firstImage = cards[0].querySelector('.card-front img')?.getAttribute('src')
    const matchingCard = cards.slice(1).find((card) => card.querySelector('.card-front img')?.getAttribute('src') === firstImage)!
    fireEvent.click(cards[0])
    fireEvent.click(matchingCard)
    act(() => vi.advanceTimersByTime(100))

    expect(screen.getByTestId('golden-alert')).toBeTruthy()
    expect(screen.getByText('เปิดแมวทอง แล้วหาคู่ให้ทันใน 2.5 วินาที!')).toBeTruthy()
    expect(document.querySelector('.board-layout')?.getAttribute('data-board-layout')).toBe('3x2')

    act(() => vi.advanceTimersByTime(100))
    expect(screen.getByTestId('golden-timer')).toBeTruthy()
    expect(screen.getByTestId('golden-timer').querySelector('strong')?.textContent).toBe('2.5s')
  })

  it('uses configured Score values in the visible Match feedback', () => {
    const config = createGameConfig({
      rounds: { layouts: [{ rows: 2, columns: 2, cardCount: 4 }] },
      flow: { countdownMs: 0, firstTurnHintMs: 0 },
      scoring: { matchScore: 7, mismatchPenalty: 3 },
      goldenEvent: { startRound: 99 },
    })

    render(<App config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'แตะเพื่อเริ่ม' }))
    act(() => vi.advanceTimersByTime(100))
    act(() => vi.advanceTimersByTime(100))
    act(() => vi.advanceTimersByTime(100))

    const cardsByCharacterImage = new Map<string, HTMLButtonElement[]>()
    for (const card of document.querySelectorAll<HTMLButtonElement>('button.card-button')) {
      const image = card.querySelector('.card-front img')?.getAttribute('src')
      if (!image) continue
      cardsByCharacterImage.set(image, [...(cardsByCharacterImage.get(image) ?? []), card])
    }
    const matchingPair = [...cardsByCharacterImage.values()].find((cards) => cards.length === 2)!
    fireEvent.click(matchingPair[0])
    fireEvent.click(matchingPair[1])

    expect(screen.getByRole('status').textContent).toContain('+7')
  })

  it('plays one sound for each visible Countdown number', () => {
    render(<App config={createGameConfig({ goldenEvent: { startRound: 99 } })} />)
    fireEvent.click(screen.getByRole('button', { name: 'แตะเพื่อเริ่ม' }))

    const countdownCalls = () => vi.mocked(playSound).mock.calls.filter(([name]) => name === 'countdown')
    expect(countdownCalls()).toHaveLength(1)

    act(() => vi.advanceTimersByTime(1_000))
    expect(countdownCalls()).toHaveLength(2)

    act(() => vi.advanceTimersByTime(1_000))
    expect(countdownCalls()).toHaveLength(3)
  })

  it('plays a start cue before the Countdown begins', () => {
    render(<App config={createGameConfig({ goldenEvent: { startRound: 99 } })} />)
    fireEvent.click(screen.getByRole('button', { name: 'แตะเพื่อเริ่ม' }))

    expect(vi.mocked(playSound).mock.calls.slice(0, 2).map(([name]) => name)).toEqual(['start', 'countdown'])
  })

  it('uses the latest sound preference for delayed Match impact feedback', () => {
    render(<App config={createGameConfig({ flow: { countdownMs: 0, firstTurnHintMs: 0 }, goldenEvent: { startRound: 99 } })} />)
    fireEvent.click(screen.getByRole('button', { name: 'แตะเพื่อเริ่ม' }))
    act(() => vi.advanceTimersByTime(100))

    const cardsByCharacterImage = new Map<string, HTMLButtonElement[]>()
    for (const card of document.querySelectorAll<HTMLButtonElement>('button.card-button')) {
      const image = card.querySelector('.card-front img')?.getAttribute('src')
      if (!image) continue
      cardsByCharacterImage.set(image, [...(cardsByCharacterImage.get(image) ?? []), card])
    }
    const matchingPair = [...cardsByCharacterImage.values()].find((cards) => cards.length === 2)!
    fireEvent.click(matchingPair[0])
    fireEvent.click(matchingPair[1])
    fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }))

    act(() => vi.advanceTimersByTime(260))

    expect(vi.mocked(playSound).mock.calls.filter(([name]) => name === 'match-impact')).toHaveLength(0)
  })

  it('clears feedback from the previous session when Replay creates a new Game Session', () => {
    const config = createGameConfig({
      session: { durationMs: 100 },
      flow: { countdownMs: 0, firstTurnHintMs: 0 },
      goldenEvent: { startRound: 99 },
    })
    render(<App config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'แตะเพื่อเริ่ม' }))
    act(() => vi.advanceTimersByTime(200))

    const cardsByCharacterImage = new Map<string, HTMLButtonElement[]>()
    for (const card of document.querySelectorAll<HTMLButtonElement>('button.card-button')) {
      const image = card.querySelector('.card-front img')?.getAttribute('src')
      if (!image) continue
      cardsByCharacterImage.set(image, [...(cardsByCharacterImage.get(image) ?? []), card])
    }
    const matchingPair = [...cardsByCharacterImage.values()].find((cards) => cards.length === 2)!
    fireEvent.click(matchingPair[0])
    fireEvent.click(matchingPair[1])
    expect(screen.getByText('MATCH!', { exact: true })).toBeTruthy()

    act(() => vi.advanceTimersByTime(100))
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))

    expect(screen.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeTruthy()
    expect(screen.queryByText('MATCH!', { exact: true })).toBeNull()
  })
})
