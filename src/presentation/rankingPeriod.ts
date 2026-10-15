export function formatRankingPeriod(period: { startsAt: string; endsAt: string }) {
  const start = new Date(period.startsAt)
  const next = new Date(period.endsAt)
  // Server periods are [startsAt, endsAt): midnight on the 19th belongs to the next period.
  const last = new Date(next.getTime() - 1)
  const timeZone = 'Asia/Bangkok'
  const year = new Intl.DateTimeFormat('th-TH', { year: 'numeric', timeZone })
  const date = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', timeZone,
    ...(year.format(start) !== year.format(next) ? { year: 'numeric' as const } : {}),
  })
  const time = new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
  })
  return {
    range: date.formatRange(start, last).replace(/\s*–\s*/g, '–'),
    nextDate: date.format(next),
    nextTime: time.format(next),
  }
}
