import { GameCenterEntry } from './vendor/game-center.js'
import { createLocalEntry } from './localGameCenter'

// Vite enables this only for its development server, never a build or preview.
// Test mode keeps API integration fixtures exercising the real SDK.
export const LOCAL_GAME_CENTER = __CAT_CARD_LOCAL_DEVELOPMENT__ &&
  typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

// Verified against the existing catalog and play-config on 2026-10-15.
export const GAME_CENTER_URL = 'https://center.game.gamification.in.th'
export const GAME_ID = 'cat-card'
export const GAME_VERSION = '1.0.0'
export const GAME_MODE = 'default'

export type ResultPayload = {
  schemaVersion: 1
  gameVersion: string
  score: string
  outcome: 'complete'
  clientEndedAt: string
  stats: Record<string, never>
}
export type ResultReceipt = {
  status: 'accepted' | 'pending' | 'rejected' | 'quarantined' | 'deleted'
  rankingEligible: boolean
}
export type RoundClient = { finish(payload: ResultPayload): Promise<ResultReceipt> }
export type Entry = {
  access(): Promise<RoundClient | null>
  beginRound(options: { mode: string }): Promise<RoundClient | null>
  signIn(): unknown
}
export type PlayConfig = {
  enabled: boolean
  gameVersions: string[]
  modes: string[]
  direction: 'asc' | 'desc'
  modeRules?: Record<string, { direction?: 'asc' | 'desc' }>
}
export type Submission = {
  id: number
  score: string
  status: 'sending' | 'error' | ResultReceipt['status']
  rankingEligible?: boolean
}
type Round = { client: RoundClient; submission?: Submission; payload?: ResultPayload; sending?: Promise<void> }
export type CenterState = {
  access: 'connecting' | 'ready' | 'error'
  starting: boolean
  error: string | null
  submissions: Submission[]
}

export function centerError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (code === 'unauthorized' || code === 'invalid_grant' || code === 'grant_expired') {
    return 'สิทธิ์เข้าเกมหมดอายุ กรุณาเข้าสู่ระบบใหม่'
  }
  if (code === 'scoring_disabled') return 'Game Center ยังไม่เปิดรับรอบของเกมนี้ กรุณาลองใหม่ภายหลัง'
  return 'เชื่อมต่อ Game Center ไม่สำเร็จ กรุณาลองใหม่ หรือเข้าสู่ระบบใหม่'
}

export async function readPlayConfig(): Promise<PlayConfig> {
  const response = await fetch(`${GAME_CENTER_URL}/api/v1/games/${GAME_ID}/play-config`, {
    credentials: 'omit', signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Play config unavailable')
  return (await response.json()).data
}

// This store owns remote round clients independently of React renders and replay UI.
// Older failed submissions remain retryable after a new local Game Session begins.
export class GameCenter {
  private state: CenterState = { access: 'connecting', starting: false, error: null, submissions: [] }
  private listeners = new Set<() => void>()
  private rounds = new Map<object, Round>()
  private startPromise?: Promise<boolean>
  private entry: Entry
  private ready: Promise<RoundClient | null>
  constructor(entry: Entry, private config: () => Promise<PlayConfig> = readPlayConfig) {
    this.entry = entry
    this.ready = entry.access()
    void this.ready.then(client => {
      if (client) this.update({ access: 'ready' })
    }).catch(error => this.update({ access: 'error', error: centerError(error) }))
  }
  snapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private update(patch: Partial<CenterState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach(listener => listener())
  }
  signIn = () => { this.entry.signIn() }
  start(owner: object, activate: () => void): Promise<boolean> {
    if (this.rounds.has(owner)) return Promise.resolve(false)
    if (this.startPromise) return this.startPromise
    this.update({ starting: true, error: null })
    this.startPromise = (async () => {
      try {
        if (!await this.ready) return false
        const config = await this.config()
        if (!config.enabled) throw Object.assign(new Error(), { code: 'scoring_disabled' })
        if (!config.gameVersions.includes(GAME_VERSION) || !config.modes.includes(GAME_MODE) ||
          (config.modeRules?.[GAME_MODE]?.direction ?? config.direction) !== 'desc') {
          this.update({ error: 'การตั้งค่าเกมบน Game Center ไม่ตรงกับรุ่นหรือกติกาคะแนน กรุณาติดต่อผู้ดูแล' })
          return false
        }
        const client = await this.entry.beginRound({ mode: GAME_MODE })
        if (!client) return false
        this.rounds.set(owner, { client })
        this.update({ access: 'ready' })
        activate()
        return true
      } catch (error) {
        this.update({ error: centerError(error) })
        return false
      } finally {
        this.startPromise = undefined
        this.update({ starting: false })
      }
    })()
    return this.startPromise
  }
  finish(owner: object, score: number) {
    const round = this.rounds.get(owner)
    if (!round || round.payload) return
    round.payload = Object.freeze({
      schemaVersion: 1, gameVersion: GAME_VERSION, score: String(score), outcome: 'complete',
      clientEndedAt: new Date().toISOString(), stats: {},
    })
    round.submission = { id: this.state.submissions.length + 1, score: String(score), status: 'sending' }
    this.update({ submissions: [...this.state.submissions, round.submission] })
    void this.send(round)
  }
  retry = (id: number) => {
    const round = [...this.rounds.values()].find(round => round.submission?.id === id)
    if (round?.submission?.status === 'error') void this.send(round)
  }
  private send(round: Round): Promise<void> {
    if (round.sending) return round.sending
    const submission = round.submission!
    const publish = (patch: Partial<Submission>) => {
      round.submission = { ...round.submission!, ...patch }
      this.update({ submissions: this.state.submissions.map(item => item.id === submission.id ? round.submission! : item) })
    }
    publish({ status: 'sending' })
    round.sending = round.client.finish(round.payload!).then(receipt => {
      publish({ status: receipt.status, rankingEligible: receipt.rankingEligible })
    }).catch(() => publish({ status: 'error' })).finally(() => { round.sending = undefined })
    return round.sending
  }
}

let center: GameCenter | undefined
export function getGameCenter(): GameCenter {
  // One entry per browser page, even under Strict Mode's effect replay.
  if (LOCAL_GAME_CENTER) return center ??= new GameCenter(createLocalEntry(), async () => ({
    enabled: true, gameVersions: [GAME_VERSION], modes: [GAME_MODE], direction: 'desc',
  }))
  return center ??= new GameCenter(new GameCenterEntry({ baseUrl: GAME_CENTER_URL, gameId: GAME_ID }))
}

export type Leaderboard = {
  data: {
    memberId: string
    displayName: string
    memberKind: 'guest' | 'registered'
    score: string
    rank: number
    avatar: { url: string; label: string }
  }[]
  meta: { period?: { id?: string; startsAt: string; endsAt: string; timezone?: string } }
}
export async function readLeaderboard(signal: AbortSignal): Promise<Leaderboard> {
  if (LOCAL_GAME_CENTER) return { data: [], meta: {} }
  const response = await fetch(`${GAME_CENTER_URL}/api/v1/games/${GAME_ID}/leaderboards/current/entries?mode=${GAME_MODE}&limit=5`, {
    credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  if (!response.ok) throw new Error('Leaderboard unavailable')
  return response.json()
}
