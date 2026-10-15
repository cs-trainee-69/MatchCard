import { describe, expect, it, vi } from 'vitest'
import { GameCenter, type Entry, type PlayConfig, type ResultPayload, type ResultReceipt } from './gameCenter'

const config: PlayConfig = { enabled: true, gameVersions: ['1.0.0'], modes: ['default'], direction: 'desc' }
const receipt: ResultReceipt = { status: 'accepted', rankingEligible: false }
function setup() {
  const finish = vi.fn<(payload: ResultPayload) => Promise<ResultReceipt>>().mockResolvedValue(receipt)
  const entry: Entry = { access: vi.fn().mockResolvedValue({ finish }), beginRound: vi.fn().mockResolvedValue({ finish }), signIn: vi.fn() }
  const readConfig = vi.fn().mockResolvedValue(config)
  const center = new GameCenter(entry, readConfig)
  return { center, entry, finish, readConfig }
}
async function flush() { await new Promise(resolve => setTimeout(resolve, 0)) }

describe('Game Center round lifecycle', () => {
  it('does not count lobby access and coalesces repeated Start before activating controls', async () => {
    const { center, entry } = setup()
    await flush()
    expect(entry.beginRound).not.toHaveBeenCalled()
    let resolve!: (value: Awaited<ReturnType<Entry['beginRound']>>) => void
    vi.mocked(entry.beginRound).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const owner = {}, activate = vi.fn()
    const first = center.start(owner, activate)
    const second = center.start(owner, activate)
    await flush()
    expect(first).toBe(second)
    expect(activate).not.toHaveBeenCalled()
    resolve({ finish: vi.fn() })
    await first
    expect(activate).toHaveBeenCalledTimes(1)
    await center.start(owner, activate)
    expect(entry.beginRound).toHaveBeenCalledTimes(1)
  })
  it('blocks gameplay on gate/config failure and can retry a failed round start', async () => {
    const { center, entry, readConfig } = setup()
    const activate = vi.fn(), owner = {}
    readConfig.mockResolvedValueOnce({ ...config, enabled: false })
    expect(await center.start(owner, activate)).toBe(false)
    expect(entry.beginRound).not.toHaveBeenCalled()
    vi.mocked(entry.beginRound).mockRejectedValueOnce(new Error('network'))
    expect(await center.start(owner, activate)).toBe(false)
    expect(activate).not.toHaveBeenCalled()
    expect(await center.start(owner, activate)).toBe(true)
  })
  it('rejects unsupported versions/modes and ascending score configuration', async () => {
    for (const invalid of [{ gameVersions: ['9'] }, { modes: ['other'] }, { direction: 'asc' }]) {
      const { center, entry, readConfig } = setup()
      readConfig.mockResolvedValue({ ...config, ...invalid })
      expect(await center.start({}, vi.fn())).toBe(false)
      expect(entry.beginRound).not.toHaveBeenCalled()
    }
  })
  it('blocks exchange failure and offers explicit fresh sign-in', async () => {
    const entry: Entry = { access: vi.fn().mockRejectedValue({ code: 'invalid_grant' }), beginRound: vi.fn(), signIn: vi.fn() }
    const center = new GameCenter(entry)
    await flush()
    expect(center.snapshot().access).toBe('error')
    expect(await center.start({}, vi.fn())).toBe(false)
    expect(entry.beginRound).not.toHaveBeenCalled()
    center.signIn()
    expect(entry.signIn).toHaveBeenCalledOnce()
  })
  it('pins final units/time/outcome and retains the old client for retry after replay', async () => {
    const { center, entry, finish } = setup()
    const first = {}, second = {}, activate = vi.fn()
    finish.mockRejectedValueOnce(new Error('network'))
    await center.start(first, activate)
    center.finish(first, 105)
    center.finish(first, 999)
    await flush()
    const original = finish.mock.calls[0][0]
    expect(original).toMatchObject({ score: '105', outcome: 'complete', gameVersion: '1.0.0', stats: {} })
    const nextFinish = vi.fn().mockResolvedValue({ status: 'pending', rankingEligible: false })
    vi.mocked(entry.beginRound).mockResolvedValueOnce({ finish: nextFinish })
    await center.start(second, activate)
    center.finish(second, 20)
    await flush()
    center.retry(1)
    center.retry(1)
    await flush()
    expect(finish).toHaveBeenCalledTimes(2)
    expect(finish.mock.calls[1][0]).toBe(original)
    expect(nextFinish).toHaveBeenCalledOnce()
    expect(center.snapshot().submissions).toEqual([
      expect.objectContaining({ id: 1, score: '105', status: 'accepted', rankingEligible: false }),
      expect.objectContaining({ id: 2, score: '20', status: 'pending' }),
    ])
  })
  it.each(['accepted', 'pending', 'rejected', 'quarantined', 'deleted'] as const)('keeps receipt %s and eligibility independent', async status => {
    const { center, finish } = setup()
    finish.mockResolvedValue({ status, rankingEligible: false })
    const owner = {}
    await center.start(owner, vi.fn())
    center.finish(owner, 0)
    await flush()
    expect(center.snapshot().submissions[0]).toMatchObject({ status, rankingEligible: false, score: '0' })
  })
})
