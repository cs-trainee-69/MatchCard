import { describe, expect, it } from 'vitest'
import { formatRankingPeriod } from './rankingPeriod'

describe('ranking period copy in Thai time', () => {
  it('converts UTC and excludes midnight of the next period from the displayed week', () => {
    expect(formatRankingPeriod({ startsAt: '2026-10-11T17:00:00Z', endsAt: '2026-10-18T17:00:00Z' })).toEqual({
      range: '12–18 ต.ค.', nextDate: '19 ต.ค.', nextTime: '00:00',
    })
  })
  it('keeps both months visible for a period crossing a month boundary', () => {
    const value = formatRankingPeriod({ startsAt: '2026-10-25T17:00:00Z', endsAt: '2026-11-01T17:00:00Z' })
    expect(value.range).toContain('ต.ค.')
    expect(value.range).toContain('พ.ย.')
    expect(value.nextDate).toBe('2 พ.ย.')
  })
  it('uses the supplied reset time and distinguishes years instead of guessing Monday midnight', () => {
    const value = formatRankingPeriod({ startsAt: '2026-12-27T17:00:00Z', endsAt: '2027-01-03T07:30:00Z' })
    expect(value.range).toContain('2569')
    expect(value.range).toContain('2570')
    expect(value.nextTime).toBe('14:30')
  })
})
