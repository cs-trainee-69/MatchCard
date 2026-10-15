import { test as base, expect } from '@playwright/test'

export type CenterMock = {
  starts: number
  exchanges: number
  results: { key: string | undefined; payload: Record<string, unknown>; session: string }[]
  failStart: boolean
  failExchange: boolean
  failResult: boolean
  failRanking: boolean
  rows: Record<string, unknown>[]
  resultStatus: string
  eligible: boolean
  startDelayMs: number
}

// All central traffic is intercepted: these tests never create production rounds.
export const test = base.extend<{ centerMock: CenterMock }>({
  centerMock: [async ({ page, baseURL }, use) => {
    if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) {
      throw new Error('These integration fixtures must run against a local game; production play is not authorized.')
    }
    const state: CenterMock = {
      starts: 0, exchanges: 0, results: [], failStart: false, failExchange: false,
      failResult: false, failRanking: false, rows: [], resultStatus: 'accepted', eligible: false, startDelayMs: 0,
    }
    await page.addInitScript(() => {
      // A fixture grant exists only inside the isolated Playwright browser.
      if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        history.replaceState(null, '', location.pathname + location.search + '#gc_grant=fixture-grant')
      }
    })
    await page.route('https://center.game.gamification.in.th/**', async route => {
      const request = route.request()
      const url = new URL(request.url())
      const json = (data: unknown, status = 200) => route.fulfill({ status, json: data })
      const session = (id: string) => ({
        playSessionId: id, playToken: `fixture-play-${id}`, replayToken: `fixture-replay-${id}`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        replayTokenExpiresAt: new Date(Date.now() + 21600000).toISOString(),
        context: { mode: 'default', rankingPeriodId: 'fixture-period', memberKindAtStart: state.eligible ? 'registered' : 'guest' }, statsSchema: {},
      })
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
      if (url.pathname.endsWith('/play-config')) return json({ data: { enabled: true, gameVersions: ['1.0.0'], modes: ['default'], direction: 'desc' } })
      if (url.pathname.endsWith('/launch-grants/exchange')) {
        state.exchanges++
        return state.failExchange ? json({ error: { code: 'invalid_grant' } }, 401) : json({ data: session('lobby') })
      }
      if (url.pathname.endsWith('/replay')) {
        if (state.startDelayMs) await new Promise(resolve => setTimeout(resolve, state.startDelayMs))
        if (state.failStart) return json({ error: { code: 'scoring_disabled' } }, 403)
        state.starts++
        return json({ data: session(`round-${state.starts}`) })
      }
      if (url.pathname.endsWith('/results')) {
        state.results.push({ key: request.headers()['idempotency-key'], payload: request.postDataJSON(), session: url.pathname.split('/').at(-2)! })
        return state.failResult ? json({ error: { code: 'temporary_error' } }, 503) : json({ data: { status: state.resultStatus, rankingEligible: state.eligible } })
      }
      if (url.pathname.includes('/leaderboards/current/entries')) {
        return state.failRanking ? json({ error: { code: 'unavailable' } }, 503) : json({
          data: state.rows, meta: { period: { id: 'fixture-period', startsAt: '2026-10-12T00:00:00+07:00', endsAt: '2026-10-19T00:00:00+07:00', timezone: 'Asia/Bangkok' } },
        })
      }
      // Avatar assets need no external requests either.
      if (url.pathname.startsWith('/fixture-avatar')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="#e7b870"/></svg>' })
      throw new Error(`Unmocked Game Center request: ${request.method()} ${url.pathname}`)
    })
    await use(state)
  }, { auto: true }],
})
export { expect }
