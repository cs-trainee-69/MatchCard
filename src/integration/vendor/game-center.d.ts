import type { ResultPayload, ResultReceipt, RoundClient } from '../gameCenter'

export class GameCenterGame implements RoundClient {
  session?: { context?: { mode?: string; memberKindAtStart?: string }; statsSchema?: Record<string, unknown> }
  finish(payload: ResultPayload): Promise<ResultReceipt>
}

export class GameCenterEntry {
  constructor(options: { baseUrl: string; gameId: string; onError?: (error: unknown) => void })
  access(): Promise<GameCenterGame | null>
  beginRound(options: { mode: string }): Promise<GameCenterGame | null>
  signIn(resume?: boolean): null
}
