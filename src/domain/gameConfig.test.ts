import { describe, expect, it } from 'vitest'
import { createGameConfig, formatRuleDurationMs, InvalidGameConfigError } from './gameConfig'
import { createGameSession, getBoardLayout } from './gameSession'

describe('Game Config defaults', () => {
  it('captures the current gameplay rules in one resolved config', () => {
    const config = createGameConfig()

    expect(config.session.durationMs).toBe(120_000)
    expect(config.rounds.layouts).toEqual([
      { rows: 2, columns: 2, cardCount: 4 },
      { rows: 3, columns: 2, cardCount: 6 },
      { rows: 4, columns: 2, cardCount: 8 },
      { rows: 4, columns: 3, cardCount: 12 },
      { rows: 4, columns: 4, cardCount: 16 },
      { rows: 5, columns: 4, cardCount: 20 },
    ])
    expect(config.scoring).toEqual({ matchScore: 10, mismatchPenalty: 1 })
    expect(config.flow).toEqual({
      countdownMs: 3_000,
      firstTurnHintMs: 1_200,
      mismatchRevealMs: 700,
      roundTransitionMs: 800,
    })
    expect(config.goldenEvent).toEqual({
      startRound: 3,
      scheduleDelayMinMs: 3_000,
      scheduleDelayMaxMs: 7_000,
      minRemainingMs: 20_000,
      minHiddenPairs: 2,
      alertMs: 2_500,
      timerMs: 5_000,
      successScoreBonus: 5,
      successTimeBonusMs: 5_000,
      failureTimePenaltyMs: 5_000,
    })
  })

  it('merges nested overrides and replaces arrays as complete values', () => {
    const layouts = [{ rows: 2, columns: 2, cardCount: 4 }]
    const config = createGameConfig({
      session: { durationMs: 10_000 },
      rounds: { layouts },
      scoring: { matchScore: 20 },
    })

    expect(config.session.durationMs).toBe(10_000)
    expect(config.scoring).toEqual({ matchScore: 20, mismatchPenalty: 1 })
    expect(config.rounds.layouts).toEqual(layouts)
    expect(config.rounds.layouts).not.toBe(layouts)

    layouts[0].rows = 1
    expect(config.rounds.layouts[0].rows).toBe(2)
  })

  it('deeply freezes the resolved config without freezing caller-owned input', () => {
    const overrides = {
      session: { durationMs: 10_000 },
      rounds: { layouts: [{ rows: 2, columns: 2, cardCount: 4 }] },
    }
    const config = createGameConfig(overrides)

    expect(Object.isFrozen(config)).toBe(true)
    expect(Object.isFrozen(config.session)).toBe(true)
    expect(Object.isFrozen(config.rounds.layouts)).toBe(true)
    expect(Object.isFrozen(config.rounds.layouts[0])).toBe(true)
    expect(Object.isFrozen(overrides)).toBe(false)
    expect(Object.isFrozen(overrides.rounds.layouts)).toBe(false)
    expect(Reflect.set(config.session as object, 'durationMs', 1)).toBe(false)
    expect(config.session.durationMs).toBe(10_000)
  })
})

describe('Game Config validation', () => {
  const invalid = (overrides: Parameters<typeof createGameConfig>[0], path: string) => {
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expect(() => createGameConfig(overrides)).toThrowError(new RegExp(`${escapedPath}:`))
  }

  it('reports precise paths for invalid numeric values', () => {
    invalid({ session: { durationMs: Number.NaN } }, 'session.durationMs')
    invalid({ session: { durationMs: Number.POSITIVE_INFINITY } }, 'session.durationMs')
    invalid({ flow: { countdownMs: Number.MAX_SAFE_INTEGER + 1 } }, 'flow.countdownMs')
    invalid({ flow: { mismatchRevealMs: 1.5 } }, 'flow.mismatchRevealMs')
    invalid({ goldenEvent: { successTimeBonusMs: -1 } }, 'goldenEvent.successTimeBonusMs')
    invalid({ rounds: { layouts: [{ rows: 2.5, columns: 2, cardCount: 4 }] } }, 'rounds.layouts[0].rows')
  })

  it('rejects impossible layouts and Golden Card Event relationships', () => {
    invalid({ rounds: { layouts: [] } }, 'rounds.layouts')
    invalid({ rounds: { layouts: [{ rows: 2, columns: 2, cardCount: 3 }] } }, 'rounds.layouts[0].cardCount')
    invalid({ rounds: { layouts: [{ rows: 2, columns: 2, cardCount: 6 }] } }, 'rounds.layouts[0].cardCount')
    invalid({ rounds: { layouts: [{ rows: 2, columns: 11, cardCount: 22 }] } }, 'rounds.layouts[0].cardCount')
    invalid({ goldenEvent: { scheduleDelayMinMs: 8_000, scheduleDelayMaxMs: 7_000 } }, 'goldenEvent.scheduleDelayMinMs')
    invalid({ goldenEvent: { startRound: 0 } }, 'goldenEvent.startRound')
  })

  it('allows zero values only where the contract permits them', () => {
    const config = createGameConfig({
      session: { durationMs: 1 },
      scoring: { matchScore: 0, mismatchPenalty: 0 },
      flow: { countdownMs: 0, firstTurnHintMs: 0, mismatchRevealMs: 0, roundTransitionMs: 0 },
      goldenEvent: {
        scheduleDelayMinMs: 0,
        scheduleDelayMaxMs: 0,
        minRemainingMs: 0,
        alertMs: 0,
        successScoreBonus: 0,
        successTimeBonusMs: 0,
        failureTimePenaltyMs: 0,
      },
    })

    expect(config.flow.countdownMs).toBe(0)
    expect(() => createGameConfig({ session: { durationMs: 0 } })).toThrowError(/session\.durationMs/)
    expect(() => createGameConfig({ goldenEvent: { timerMs: 0 } })).toThrowError(/goldenEvent\.timerMs/)
  })

  it('allows a Golden Card Event threshold that defers activation indefinitely', () => {
    const config = createGameConfig({ goldenEvent: { minHiddenPairs: 11 } })

    expect(config.goldenEvent.minHiddenPairs).toBe(11)
  })
})

describe('Game Config public consumers', () => {
  it('keeps Board layout and a Game Session on the same custom config', () => {
    const config = createGameConfig({
      session: { durationMs: 10_000 },
      rounds: { layouts: [{ rows: 2, columns: 2, cardCount: 4 }] },
    })
    const session = createGameSession(config, { random: () => 0 })

    expect(session.getConfig()).toEqual(config)
    expect(session.getConfig()).not.toBe(config)
    expect(getBoardLayout(7, session.getConfig())).toEqual({ rows: 2, columns: 2, cardCount: 4 })
    session.dispatch({ type: 'begin' })
    expect(session.getState().remainingMs).toBe(10_000)
    expect(session.getState().board).toHaveLength(4)
  })

  it('formats rule durations without losing fractional seconds', () => {
    expect(formatRuleDurationMs(2_500)).toBe('2.5 seconds')
    expect(formatRuleDurationMs(5_000)).toBe('5 seconds')
    expect(formatRuleDurationMs(123)).toBe('0.123 seconds')
  })

  it('keeps a session snapshot independent from later factories and caller changes', () => {
    const overrides = { session: { durationMs: 10_000 } }
    const config = createGameConfig(overrides)
    const session = createGameSession({ config, random: () => 0 })
    overrides.session.durationMs = 1
    createGameConfig({ session: { durationMs: 2_000 } })

    expect(session.getConfig().session.durationMs).toBe(10_000)
    expect(session.getState().remainingMs).toBe(10_000)
  })

  it('exposes validation errors as the documented error type', () => {
    try {
      createGameConfig({ rounds: { layouts: [{ rows: 1, columns: 1, cardCount: 1 }] } })
      throw new Error('expected validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidGameConfigError)
      expect((error as InvalidGameConfigError).path).toBe('rounds.layouts[0].cardCount')
    }
  })
})
