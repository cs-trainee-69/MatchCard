import { expect, type Page, test } from '@playwright/test'

async function startPlaying(page: Page) {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect(page.locator('.countdown-number')).toHaveText('3')
  await page.clock.fastForward(3000)
  await expect(page.getByText('จับคู่ไพ่', { exact: true })).toBeVisible()
  await expect(page.locator('.hud-time > strong')).toHaveText('2:00')
  await page.clock.fastForward(1200)
  await expect(page.getByText('จับคู่ไพ่', { exact: true })).toBeHidden()
}

async function cardGroups(page: Page): Promise<number[][]> {
  const sources = await page.locator('.card-front img').evaluateAll((images) =>
    images.map((image) => image.getAttribute('src') ?? ''),
  )
  const groups = new Map<string, number[]>()
  sources.forEach((source, index) => groups.set(source, [...(groups.get(source) ?? []), index]))
  return [...groups.values()]
}

test('starts the mobile Game Session and exposes the first Board', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeVisible()
  await expect(page.locator('.game-frame')).toBeVisible()
  await expect(page.locator('.overlay-start .overlay-card')).toHaveCount(0)
  await expect(page.locator('.sound-button .sound-icon')).toBeVisible()

  const viewport = page.viewportSize()
  const frameBox = await page.locator('.game-frame').boundingBox()
  expect(viewport).not.toBeNull()
  expect(frameBox).not.toBeNull()
  expect(Math.abs(frameBox!.width - viewport!.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(frameBox!.height - viewport!.height)).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport!.width)

  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect(page.locator('.countdown-number')).toHaveText('3')
  await page.clock.fastForward(3000)

  await expect(page.getByText('จับคู่ไพ่', { exact: true })).toBeVisible()
  await expect(page.locator('.hud-time > strong')).toHaveText('2:00')
  await expect(page.locator('button.card-button').first()).toBeDisabled()
  await page.clock.fastForward(1200)
  await expect(page.getByText('จับคู่ไพ่', { exact: true })).toBeHidden()
  await expect(page.getByText('Round', { exact: true })).toBeVisible()
  await expect(page.getByText('Score', { exact: true })).toBeVisible()
  await expect(page.getByText('Time', { exact: true })).toBeVisible()
  await expect(page.locator('button.card-button')).toHaveCount(4)
  await expect(page.locator('.board-layout')).toHaveAttribute('data-board-layout', '2x2')

  await page.locator('button.card-button').first().click()
  await expect(page.locator('button.card-button').first()).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Mute sound' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible()
})

test('finishes at zero and offers a replay result', async ({ page }) => {
  await startPlaying(page)
  await page.clock.runFor(110000)
  await expect(page.locator('.hud-time')).toHaveClass(/is-warning/)
  await page.clock.runFor(10000)

  await expect(page.getByText("Time's up")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible()
  await expect(page.locator('.result-grid strong').nth(0)).toHaveText('0')
  await expect(page.locator('.result-grid strong').nth(1)).toHaveText('0')
  await expect(page.locator('.result-grid strong').nth(2)).toHaveText('1')
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeVisible()
})

test('scores Match and Mismatch through the visible Board', async ({ page }) => {
  await startPlaying(page)
  const cards = page.locator('button.card-button')
  const groups = await cardGroups(page)

  await cards.nth(groups[0][0]).click()
  await cards.nth(groups[1][0]).click()
  await expect(page.locator('.hud-score > strong')).toHaveText('0')
  await expect(page.getByText('MISMATCH!')).toBeVisible()
  await page.clock.fastForward(700)

  await cards.nth(groups[0][0]).click()
  await cards.nth(groups[0][1]).click()
  await expect(page.locator('.hud-score > strong')).toHaveText('10')
  const feedback = page.locator('.feedback-toast')
  await expect(page.getByText('MATCH!')).toBeVisible()
  const frameBox = await page.locator('.game-frame').boundingBox()
  const scoreBoxAfter = await page.locator('.hud-score').boundingBox()
  const feedbackBox = await feedback.boundingBox()
  expect(frameBox).not.toBeNull()
  expect(scoreBoxAfter).not.toBeNull()
  expect(feedbackBox).not.toBeNull()
  expect(feedbackBox!.x).toBeGreaterThanOrEqual(frameBox!.x)
  expect(feedbackBox!.x + feedbackBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width)
  expect(scoreBoxAfter!.x).toBeGreaterThanOrEqual(frameBox!.x)
  expect(scoreBoxAfter!.x + scoreBoxAfter!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width)
})

test('advances from the first Board to the six-card Round', async ({ page }) => {
  await startPlaying(page)
  const cards = page.locator('button.card-button')
  const groups = await cardGroups(page)

  for (const group of groups) {
    await cards.nth(group[0]).click()
    await cards.nth(group[1]).click()
  }

  await expect(page.getByText('Round 2')).toBeVisible()
  await page.clock.fastForward(800)
  await expect(cards).toHaveCount(6)
  await expect(page.locator('.board-layout')).toHaveAttribute('data-board-layout', '2x3')
})

test('keeps every planned Board layout usable through Round 5', async ({ page }) => {
  await startPlaying(page)
  const expectedBoards = [
    { count: 4, layout: '2x2' },
    { count: 6, layout: '2x3' },
    { count: 8, layout: '2x4' },
    { count: 12, layout: '3x4' },
    { count: 16, layout: '4x4' },
  ]

  for (const [index, expected] of expectedBoards.entries()) {
    const cards = page.locator('button.card-button')
    await expect(cards).toHaveCount(expected.count)
    await expect(page.locator('.board-layout')).toHaveAttribute('data-board-layout', expected.layout)

    const frameBox = await page.locator('.game-frame').boundingBox()
    const lastCardBox = await cards.last().boundingBox()
    expect(frameBox).not.toBeNull()
    expect(lastCardBox).not.toBeNull()
    expect(lastCardBox!.x + lastCardBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width + 1)
    expect(lastCardBox!.y + lastCardBox!.height).toBeLessThanOrEqual(frameBox!.y + frameBox!.height + 1)

    if (index === expectedBoards.length - 1) break

    const groups = await cardGroups(page)
    for (const group of groups) {
      await cards.nth(group[0]).click()
      await cards.nth(group[1]).click()
    }
    await page.clock.fastForward(800)
  }
})

test('keeps a complete centered 9:16 surface in mobile landscape', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 })
  await page.goto('/')
  const frame = page.locator('.game-frame')
  const box = await frame.boundingBox()

  expect(box).not.toBeNull()
  expect(Math.abs((box!.width / box!.height) - 9 / 16)).toBeLessThan(0.01)
  expect(box!.width).toBeLessThanOrEqual(851)
  expect(box!.height).toBeLessThanOrEqual(393)
  expect(Math.abs(box!.x + box!.width / 2 - 425.5)).toBeLessThan(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(851)

  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await page.clock.fastForward(4200)
  const firstCard = page.locator('button.card-button').first()
  const firstCardBox = await firstCard.boundingBox()
  expect(firstCardBox).not.toBeNull()
  expect(firstCardBox!.width).toBeGreaterThanOrEqual(40)
  await firstCard.click()
  await expect(firstCard).toHaveAttribute('aria-pressed', 'true')
})

test('keeps a small portrait Board inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await page.clock.fastForward(4200)

  const viewport = page.viewportSize()
  const frameBox = await page.locator('.game-frame').boundingBox()
  const boardBox = await page.locator('.board-layout').boundingBox()
  expect(viewport).not.toBeNull()
  expect(frameBox).not.toBeNull()
  expect(boardBox).not.toBeNull()
  expect(boardBox!.x).toBeGreaterThanOrEqual(frameBox!.x)
  expect(boardBox!.x + boardBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width)
  expect(boardBox!.y + boardBox!.height).toBeLessThanOrEqual(frameBox!.y + frameBox!.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport!.width)
})

test('keeps the game surface centered at 9:16 on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  const frame = page.locator('.game-frame')
  const box = await frame.boundingBox()

  expect(box).not.toBeNull()
  expect(Math.abs((box!.width / box!.height) - 9 / 16)).toBeLessThan(0.01)
  expect(Math.abs(box!.x + box!.width / 2 - 640)).toBeLessThan(2)
})

test('pauses on document visibility changes and resumes with a countdown', async ({ page }) => {
  await startPlaying(page)

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByText('Game paused')).toBeVisible()

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.countdown-number')).toHaveText('3')
  await page.clock.fastForward(3000)
  await expect(page.getByText('จับคู่ไพ่', { exact: true })).toBeHidden()
})

test('persists a new High Score for the next Game Session', async ({ page }) => {
  await startPlaying(page)
  const cards = page.locator('button.card-button')
  const [firstPair] = await cardGroups(page)
  await cards.nth(firstPair[0]).click()
  await cards.nth(firstPair[1]).click()
  await expect(page.locator('.hud-score > strong')).toHaveText('10')
  await page.clock.runFor(120000)
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible()
  await expect(page.locator('.result-grid strong').nth(1)).toHaveText('10')

  await page.reload()
  await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeVisible()
  await expect(page.evaluate(() => window.localStorage.getItem('cat-card.high-score'))).resolves.toBe('10')
})
