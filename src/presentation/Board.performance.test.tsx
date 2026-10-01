/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { createGameConfig } from '../domain/gameConfig'

const registrations = vi.hoisted(() => vi.fn())
vi.mock('../audio', () => ({ cancelDelayedSounds: vi.fn(), playSound: vi.fn() }))
vi.mock('../feedback/useGameFeedback', async (importOriginal) => {
  const original = await importOriginal<typeof import('../feedback/useGameFeedback')>()
  const { useCallback } = await import('react')
  return {
    ...original,
    useGameFeedback: (options: Parameters<typeof original.useGameFeedback>[0]) => {
      const feedback = original.useGameFeedback(options)
      const registerCardRef = useCallback((id: string, element: HTMLButtonElement | null) => {
        registrations(id, element)
        feedback.registerCardRef(id, element)
      }, [feedback.registerCardRef])
      return { ...feedback, registerCardRef }
    },
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  registrations.mockClear()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('does not detach and re-register Board cards on clock ticks, while selections still update', () => {
  render(<App config={createGameConfig({
    flow: { countdownMs: 0, firstTurnHintMs: 0 },
    goldenEvent: { startRound: 99 },
  })} />)
  fireEvent.click(screen.getByRole('button', { name: 'แตะเพื่อเริ่ม' }))
  act(() => vi.advanceTimersByTime(200))
  registrations.mockClear()
  for (let tick = 0; tick < 10; tick += 1) act(() => vi.advanceTimersByTime(100))
  expect(document.querySelector('.hud-time strong')?.textContent).toBe('1:59')
  expect(registrations).not.toHaveBeenCalled()
  const card = screen.getByRole('button', { name: 'Hidden card 1' })
  fireEvent.click(card)
  expect(card.getAttribute('aria-pressed')).toBe('true')
  expect(registrations).not.toHaveBeenCalled()
})
