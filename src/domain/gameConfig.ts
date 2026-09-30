import { CAT_CHARACTER_IDS } from './catCharacters'

export type RoundLayout = {
  rows: number
  columns: number
  cardCount: number
}

export type GameConfigShape = {
  session: {
    durationMs: number
  }
  rounds: {
    layouts: RoundLayout[]
  }
  scoring: {
    matchScore: number
    mismatchPenalty: number
  }
  flow: {
    countdownMs: number
    firstTurnHintMs: number
    mismatchRevealMs: number
    roundTransitionMs: number
  }
  goldenEvent: {
    startRound: number
    scheduleDelayMinMs: number
    scheduleDelayMaxMs: number
    minRemainingMs: number
    minHiddenPairs: number
    alertMs: number
    timerMs: number
    successScoreBonus: number
    successTimeBonusMs: number
    failureTimePenaltyMs: number
  }
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? ReadonlyArray<DeepReadonly<Item>>
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T

export type GameConfig = DeepReadonly<GameConfigShape>

export type GameConfigOverrides = {
  session?: Partial<GameConfigShape['session']>
  rounds?: {
    layouts?: ReadonlyArray<Readonly<RoundLayout>>
  }
  scoring?: Partial<GameConfigShape['scoring']>
  flow?: Partial<GameConfigShape['flow']>
  goldenEvent?: Partial<GameConfigShape['goldenEvent']>
}

const DEFAULT_GAME_CONFIG_VALUES: GameConfigShape = {
  session: {
    durationMs: 120_000,
  },
  rounds: {
    layouts: [
      { rows: 2, columns: 2, cardCount: 4 },
      { rows: 3, columns: 2, cardCount: 6 },
      { rows: 4, columns: 2, cardCount: 8 },
      { rows: 4, columns: 3, cardCount: 12 },
      { rows: 4, columns: 4, cardCount: 16 },
      { rows: 5, columns: 4, cardCount: 20 },
    ],
  },
  scoring: {
    matchScore: 10,
    mismatchPenalty: 1,
  },
  flow: {
    countdownMs: 3_000,
    firstTurnHintMs: 1_200,
    mismatchRevealMs: 700,
    roundTransitionMs: 800,
  },
  goldenEvent: {
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
  },
}

function cloneConfig(source: GameConfigShape): GameConfigShape {
  return {
    session: { ...source.session },
    rounds: { layouts: source.rounds.layouts.map((layout) => ({ ...layout })) },
    scoring: { ...source.scoring },
    flow: { ...source.flow },
    goldenEvent: { ...source.goldenEvent },
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function fail(path: string, message: string): never {
  throw new InvalidGameConfigError(path, message)
}

function validateNonnegativeInteger(value: number, path: string, { positive = false } = {}): void {
  if (!Number.isFinite(value)) fail(path, 'must be a finite number')
  if (!Number.isSafeInteger(value)) fail(path, 'must be a safe integer')
  if (positive ? value <= 0 : value < 0) fail(path, positive ? 'must be greater than zero' : 'must not be negative')
}

function validateConfig(config: GameConfigShape): void {
  validateNonnegativeInteger(config.session.durationMs, 'session.durationMs', { positive: true })

  if (config.rounds.layouts.length === 0) fail('rounds.layouts', 'must contain at least one layout')
  config.rounds.layouts.forEach((layout, index) => {
    const path = `rounds.layouts[${index}]`
    if (!layout || typeof layout !== 'object') fail(path, 'must be an object')
    validateNonnegativeInteger(layout.rows, `${path}.rows`, { positive: true })
    validateNonnegativeInteger(layout.columns, `${path}.columns`, { positive: true })
    validateNonnegativeInteger(layout.cardCount, `${path}.cardCount`, { positive: true })
    if (layout.cardCount % 2 !== 0) fail(`${path}.cardCount`, 'must be even')
    if (layout.rows * layout.columns !== layout.cardCount) fail(`${path}.cardCount`, 'rows * columns must equal cardCount')
    if (layout.cardCount / 2 > CAT_CHARACTER_IDS.length) {
      fail(`${path}.cardCount`, `requires more than ${CAT_CHARACTER_IDS.length} Cat Characters`)
    }
  })

  validateNonnegativeInteger(config.scoring.matchScore, 'scoring.matchScore')
  validateNonnegativeInteger(config.scoring.mismatchPenalty, 'scoring.mismatchPenalty')

  validateNonnegativeInteger(config.flow.countdownMs, 'flow.countdownMs')
  validateNonnegativeInteger(config.flow.firstTurnHintMs, 'flow.firstTurnHintMs')
  validateNonnegativeInteger(config.flow.mismatchRevealMs, 'flow.mismatchRevealMs')
  validateNonnegativeInteger(config.flow.roundTransitionMs, 'flow.roundTransitionMs')

  validateNonnegativeInteger(config.goldenEvent.startRound, 'goldenEvent.startRound', { positive: true })
  validateNonnegativeInteger(config.goldenEvent.scheduleDelayMinMs, 'goldenEvent.scheduleDelayMinMs')
  validateNonnegativeInteger(config.goldenEvent.scheduleDelayMaxMs, 'goldenEvent.scheduleDelayMaxMs')
  if (config.goldenEvent.scheduleDelayMinMs > config.goldenEvent.scheduleDelayMaxMs) {
    fail('goldenEvent.scheduleDelayMinMs', 'must be less than or equal to scheduleDelayMaxMs')
  }
  if (!Number.isSafeInteger(config.goldenEvent.scheduleDelayMaxMs - config.goldenEvent.scheduleDelayMinMs + 1)) {
    fail('goldenEvent.scheduleDelayMaxMs', 'schedule delay range must be a safe integer')
  }
  validateNonnegativeInteger(config.goldenEvent.minRemainingMs, 'goldenEvent.minRemainingMs')
  validateNonnegativeInteger(config.goldenEvent.minHiddenPairs, 'goldenEvent.minHiddenPairs', { positive: true })
  validateNonnegativeInteger(config.goldenEvent.alertMs, 'goldenEvent.alertMs')
  validateNonnegativeInteger(config.goldenEvent.timerMs, 'goldenEvent.timerMs', { positive: true })
  validateNonnegativeInteger(config.goldenEvent.successScoreBonus, 'goldenEvent.successScoreBonus')
  validateNonnegativeInteger(config.goldenEvent.successTimeBonusMs, 'goldenEvent.successTimeBonusMs')
  validateNonnegativeInteger(config.goldenEvent.failureTimePenaltyMs, 'goldenEvent.failureTimePenaltyMs')
}

export class InvalidGameConfigError extends Error {
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'InvalidGameConfigError'
    this.path = path
  }
}

export function createGameConfig(overrides: GameConfigOverrides = {}): GameConfig {
  const resolved = cloneConfig(DEFAULT_GAME_CONFIG_VALUES)

  if (overrides.session) resolved.session = { ...resolved.session, ...overrides.session }
  if (overrides.rounds) {
    if (overrides.rounds.layouts !== undefined && !Array.isArray(overrides.rounds.layouts)) {
      fail('rounds.layouts', 'must be an array')
    }
    resolved.rounds = {
      ...resolved.rounds,
      ...(overrides.rounds.layouts === undefined ? {} : { layouts: overrides.rounds.layouts.map((layout) => ({ ...layout })) }),
    }
  }
  if (overrides.scoring) resolved.scoring = { ...resolved.scoring, ...overrides.scoring }
  if (overrides.flow) resolved.flow = { ...resolved.flow, ...overrides.flow }
  if (overrides.goldenEvent) resolved.goldenEvent = { ...resolved.goldenEvent, ...overrides.goldenEvent }

  validateConfig(resolved)
  return deepFreeze(resolved) as GameConfig
}

export const DEFAULT_RESOLVED_GAME_CONFIG: GameConfig = createGameConfig()

export function formatRuleDurationMs(durationMs: number): string {
  const seconds = durationMs / 1000
  return `${seconds.toFixed(3).replace(/\.?(0+)$/, '')} seconds`
}
