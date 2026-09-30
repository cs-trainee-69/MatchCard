/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createGameConfig } from './domain/gameConfig'

describe('App with an active Game Config', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
})
