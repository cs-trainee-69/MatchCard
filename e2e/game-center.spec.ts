import { test, expect } from './fixtures'

for (const memberKind of ['guest', 'registered'] as const) {
  test(`uses receipt eligibility independently of ${memberKind} membership`, async ({ page, centerMock }) => {
    test.setTimeout(60000)
    centerMock.memberKind = memberKind
    centerMock.eligible = memberKind === 'guest'
    await page.clock.install()
    await page.goto('/')
    await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
    await expect(page.locator('.countdown-number')).toBeVisible()
    await page.clock.runFor(126000)
    await expect(page.getByText(centerMock.eligible ? 'รอบนี้มีสิทธิ์ขึ้นอันดับ' : 'รอบนี้ไม่มีสิทธิ์ขึ้นอันดับ', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'ดูอันดับออนไลน์' }).click()
    await expect(page.getByRole('dialog')).toContainText('สิทธิ์ขึ้นอันดับของแต่ละรอบเป็นไปตามผลตรวจจาก Game Center')
    await expect(page.getByRole('dialog')).not.toContainText('รอบทดลองของ Guest ไม่มีสิทธิ์ขึ้นอันดับ')
  })
}

test('exchanges once under Strict Mode, strips grant, and does not start in lobby', async ({ page, centerMock }) => {
  await page.goto('/?gc_mode=default#gc_grant=ignored')
  await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeEnabled()
  expect(centerMock.exchanges).toBe(1)
  expect(centerMock.starts).toBe(0)
  expect(page.url()).not.toContain('gc_grant')
})

test('missing grant redirects to central sign-in with encoded return URL', async ({ page, centerMock }) => {
  await page.addInitScript(() => { history.replaceState(null, '', location.pathname + location.search) })
  await page.route('**/sign-in?**', route => route.fulfill({ contentType: 'text/html', body: '<p>Isolated sign-in fixture</p>' }))
  await page.goto('/?gc_mode=default')
  await expect(page).toHaveURL(/\/sign-in\?game=cat-card&requireGrant=1/)
  const destination = new URL(page.url())
  expect(destination.searchParams.get('mode')).toBe('default')
  expect(destination.searchParams.get('returnTo')).toContain('gc_mode=default')
  expect(centerMock.starts).toBe(0)
})

test('failed grant blocks gameplay and offers sign-in recovery', async ({ page, centerMock }) => {
  centerMock.failExchange = true
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบใหม่' })).toBeVisible()
  await expect(page.locator('.countdown-number')).toHaveCount(0)
  expect(centerMock.starts).toBe(0)
})

test('failed Start keeps clock stopped; repeated Start creates only one round', async ({ page, centerMock }) => {
  await page.addInitScript(() => {
    const OriginalAudioContext = window.AudioContext
    window.AudioContext = class extends OriginalAudioContext {
      constructor() {
        super()
        ;(window as Window & { testAudio?: AudioContext }).testAudio = this
      }
    }
  })
  centerMock.failStart = true
  await page.goto('/')
  const start = page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })
  await start.click()
  await expect(page.getByRole('alert')).toContainText('ยังไม่เปิดรับรอบ')
  await expect(page.locator('.countdown-number')).toHaveCount(0)
  // Audio is unlocked by the original click even when the online gate fails.
  expect(await page.evaluate(() => (window as Window & { testAudio?: AudioContext }).testAudio?.state)).toBe('running')
  centerMock.failStart = false
  centerMock.startDelayMs = 300
  await start.click()
  await expect(start).toBeDisabled()
  await expect(page.locator('.countdown-number')).toBeVisible()
  expect(centerMock.starts).toBe(1)
})

test('finishes once, retains stable payload/key through retries, and replays in place', async ({ page, centerMock }) => {
  test.setTimeout(60000)
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect(page.locator('.countdown-number')).toBeVisible()
  centerMock.failResult = true
  await page.clock.runFor(126000)
  await expect(page.getByTestId('result-overlay')).toBeVisible()
  // The public SDK performs three transport attempts with the same key.
  await expect.poll(() => centerMock.results.length).toBe(1)
  await page.clock.runFor(600)
  await expect.poll(() => centerMock.results.length).toBe(2)
  await page.clock.runFor(1100)
  await expect.poll(() => centerMock.results.length).toBe(3)
  await expect(page.getByRole('button', { name: 'ลองส่งอีกครั้ง' })).toBeVisible()
  const first = centerMock.results[0]
  expect(first.payload).toMatchObject({ score: '0', outcome: 'complete', stats: {}, gameVersion: '1.0.0' })
  expect(centerMock.results).toHaveLength(3)
  await page.getByRole('button', { name: 'เล่นอีกครั้ง' }).click()
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect(page.locator('.countdown-number')).toBeVisible()
  expect(centerMock.starts).toBe(2)
  // Finish the new round, then retry the older failed result using its own client.
  centerMock.failResult = false
  await page.clock.runFor(126000)
  await expect(page.getByRole('button', { name: 'ลองส่งอีกครั้ง' })).toBeVisible()
  await page.getByRole('button', { name: 'ลองส่งอีกครั้ง' }).click()
  await expect(page.getByText(/รอบนี้ไม่มีสิทธิ์ขึ้นอันดับ/)).toBeVisible()
  const retried = centerMock.results.filter(result => result.session === first.session)
  expect(retried).toHaveLength(4)
  for (const result of retried) {
    expect(result.payload).toEqual(first.payload)
    expect(result.key).toBe(first.key)
  }
})

for (const count of [0, 1, 5]) {
  test(`Top 5 renders ${count} rows, server ties, safe names and focus on mobile`, async ({ page, centerMock }) => {
    centerMock.rows = Array.from({ length: count }, (_, index) => ({
      memberId: `fixture-${index}`, displayName: index === 0 ? '<img onerror=alert(1)> ชื่อผู้เล่นยาวมากสำหรับทดสอบการแสดงผลบนโทรศัพท์' : `ผู้เล่น ${index}`,
      memberKind: 'registered', rank: [1, 1, 2, 3, 4][index], score: String(100 - index),
      avatar: { url: 'https://center.game.gamification.in.th/fixture-avatar.svg', label: 'Fixture' },
    }))
    await page.goto('/')
    const opener = page.getByRole('button', { name: 'ดูอันดับออนไลน์' })
    if (count === 0) await page.screenshot({ path: test.info().outputPath('ranking-button.png') })
    await opener.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'ปิดอันดับ' })).toBeFocused()
    if (count) {
      await expect(dialog.locator('tbody tr')).toHaveCount(count)
      await expect(dialog.locator('.gc-player-name').first()).toContainText('<img onerror=alert(1)>')
      await expect(dialog.locator('tbody tr img')).toHaveCount(count)
      if (count === 5) expect(await dialog.locator('.gc-rank').allTextContents()).toEqual(['1', '1', '2', '3', '4'])
    } else await expect(dialog).toContainText('ยังไม่มีคะแนน')
    await expect(dialog).toContainText('19 ต.ค.')
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(count === 5 ? 'ranking-mobile.png' : `ranking-${count}-rows.png`) })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}

test('ranking errors retry and reopen cleanly', async ({ page, centerMock }) => {
  centerMock.failRanking = true
  await page.goto('/')
  await page.getByRole('button', { name: 'ดูอันดับออนไลน์' }).click()
  await expect(page.getByRole('alert')).toContainText('โหลดอันดับไม่สำเร็จ')
  await page.screenshot({ path: test.info().outputPath('ranking-error.png') })
  centerMock.failRanking = false
  await page.getByRole('button', { name: 'ลองโหลดอีกครั้ง' }).click()
  await expect(page.getByRole('dialog')).toContainText('ยังไม่มีคะแนน')
  await page.getByRole('button', { name: 'ปิดอันดับ' }).click()
  await page.getByRole('button', { name: 'ดูอันดับออนไลน์' }).click()
  await expect(page.getByRole('dialog')).toContainText('ยังไม่มีคะแนน')
})

test('a closed ranking request cannot overwrite the reopened dialog', async ({ page }) => {
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  let reopened = false
  await page.route('**/leaderboards/current/entries?**', async route => {
    requests++
    const first = !reopened
    if (first) await delayed
    await route.fulfill({ json: { data: [{
      memberId: first ? 'old' : 'new', displayName: first ? 'อันดับเก่า' : 'อันดับล่าสุด',
      memberKind: 'registered', score: '10', rank: 1, avatar: { url: '', label: '' },
    }], meta: {} } }).catch(() => { /* Closing the dialog aborts its old request. */ })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'ดูอันดับออนไลน์' }).click()
  await expect.poll(() => requests).toBeGreaterThanOrEqual(1)
  await page.getByRole('button', { name: 'ปิดอันดับ' }).click()
  reopened = true
  await page.getByRole('button', { name: 'ดูอันดับออนไลน์' }).click()
  await expect(page.getByRole('dialog')).toContainText('อันดับล่าสุด')
  release()
  await expect(page.getByRole('dialog')).not.toContainText('อันดับเก่า')
})

test('registered result sends earned Score and keeps replay clear of receipt on a short screen', async ({ page, centerMock }) => {
  test.setTimeout(60000)
  centerMock.eligible = true
  await page.setViewportSize({ width: 320, height: 480 })
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await page.clock.runFor(5500)
  const pairs = await page.locator('.card-front img').evaluateAll(images => {
    const sources = images.map(image => image.getAttribute('src'))
    const first = sources[0]
    return [0, sources.findIndex((source, index) => index > 0 && source === first)]
  })
  await page.locator('.card-button').nth(pairs[0]).click()
  await page.locator('.card-button').nth(pairs[1]).click()
  await page.clock.runFor(121000)
  await expect(page.getByText(/รอบนี้มีสิทธิ์ขึ้นอันดับ/)).toBeVisible()
  expect(centerMock.results[0].payload.score).toBe('10')
  const replay = page.getByRole('button', { name: 'เล่นอีกครั้ง' })
  await expect(replay).toBeVisible()
  const replayBox = await replay.boundingBox()
  const panelBox = await page.getByRole('complementary', { name: 'Game Center' }).boundingBox()
  expect(replayBox!.y + replayBox!.height).toBeLessThanOrEqual(panelBox!.y)
  await page.screenshot({ path: test.info().outputPath('result-short-mobile.png') })
  await replay.click()
  await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeVisible()
})

test('five-row ranking fits short mobile and desktop viewports', async ({ page, centerMock }) => {
  centerMock.rows = Array.from({ length: 5 }, (_, index) => ({
    memberId: `layout-${index}`, displayName: `ผู้เล่น ${index + 1}`, memberKind: 'registered',
    rank: index + 1, score: '100', avatar: { url: '', label: '' },
  }))
  await page.goto('/')
  for (const viewport of [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'ดูอันดับออนไลน์' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('tbody tr')).toHaveCount(5)
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`leaderboard-${viewport.width}x${viewport.height}.png`) })
    await page.getByRole('button', { name: 'ปิดอันดับ' }).click()
    await expect(dialog).toHaveCount(0)
  }
})

test('result keeps both actions inside the themed panel and rankings return focus across viewport sizes', async ({ page }) => {
  test.setTimeout(60000)
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect(page.locator('.countdown-number')).toBeVisible()
  await page.clock.runFor(126000)
  const result = page.locator('.result-card')
  await expect(result.getByText('รอบนี้ไม่มีสิทธิ์ขึ้นอันดับ')).toBeVisible()
  await expect(result).not.toContainText('บันทึกคะแนนแล้ว')
  await expect(result).not.toContainText('รับผลแล้ว')
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 480 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport)
    const ranking = result.getByRole('button', { name: 'ดูอันดับออนไลน์' })
    const replay = result.getByRole('button', { name: 'เล่นอีกครั้ง' })
    await expect(replay).toBeVisible()
    expect(await page.getByTestId('result-overlay').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await ranking.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(ranking).toBeFocused()
    await page.getByTestId('result-overlay').evaluate(element => { element.scrollTop = 0 })
    await page.screenshot({ path: test.info().outputPath(`result-${viewport.width}x${viewport.height}.png`) })
  }
  await result.getByRole('button', { name: 'เล่นอีกครั้ง' }).click()
  await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeVisible()
})
