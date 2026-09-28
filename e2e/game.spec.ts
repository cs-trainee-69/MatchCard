import { expect, type Page, test } from '@playwright/test'

async function startPlaying(page: Page) {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Tap to start' }).click()
  await expect(page.getByText('Get ready')).toBeVisible()
  await page.clock.fastForward(3000)
  await expect(page.getByText('Get ready')).toBeHidden()
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

  await expect(page.getByRole('button', { name: 'Tap to start' })).toBeVisible()
  await expect(page.locator('.game-frame')).toBeVisible()

  await page.getByRole('button', { name: 'Tap to start' }).click()
  await expect(page.getByText('Get ready')).toBeVisible()
  await page.clock.fastForward(3000)

  await expect(page.getByText('Get ready')).toBeHidden()
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
  await expect(page.getByRole('button', { name: 'Tap to start' })).toBeVisible()
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
  await expect(page.getByText('MATCH!')).toBeVisible()
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
  await expect(page.getByText('Get ready')).toBeVisible()
  await page.clock.fastForward(3000)
  await expect(page.getByText('Get ready')).toBeHidden()
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
  await expect(page.getByRole('button', { name: 'Tap to start' })).toBeVisible()
  await expect(page.evaluate(() => window.localStorage.getItem('cat-card.high-score'))).resolves.toBe('10')
})
