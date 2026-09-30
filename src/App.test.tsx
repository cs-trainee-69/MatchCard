/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playSound } from './audio'
import App from './App'
import { createGameConfig } from './domain/gameConfig'

vi.mock('./audio', () => ({ playSound: vi.fn() }))

describe('App with an active Game Config', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(playSound).mockClear()
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
})
