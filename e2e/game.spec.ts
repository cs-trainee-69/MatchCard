import { expect, type Page, test } from '@playwright/test'

async function startPlaying(page: Page) {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect(page.locator('.countdown-number')).toBeVisible()
  await page.clock.fastForward(3000)
  await expect(page.getByText('จับคู่ไพ่', { exact: true })).toBeVisible()
  await expect(page.locator('.hud-time > strong')).toHaveText('2:00')
  await page.clock.fastForward(2000)
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

async function completeCurrentBoard(page: Page) {
  const cards = page.locator('button.card-button')
  const groups = await cardGroups(page)
  for (const group of groups) {
    await cards.nth(group[0]).click()
    await cards.nth(group[1]).click()
  }
  await page.clock.fastForward(800)
}

async function advanceToFinalBoard(page: Page) {
  await startPlaying(page)
  const expectedCounts = [4, 6, 8, 12, 16, 20]

  for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
    const cards = page.locator('button.card-button')
    await expect(cards).toHaveCount(expectedCounts[roundIndex])
    await completeCurrentBoard(page)
  }

  await expect(page.locator('button.card-button')).toHaveCount(20)
  await expect(page.locator('.board-layout')).toHaveAttribute('data-board-layout', '5x4')
}

async function attemptFirstPairBeforeGoldenEvent(page: Page) {
  await page.clock.fastForward(3000)
  await expect(page.locator('[data-testid="golden-alert"]')).toBeHidden()
  const cards = page.locator('button.card-button')
  const [pair] = await cardGroups(page)
  await cards.nth(pair[0]).click()
  await page.clock.fastForward(100)
  await expect(page.locator('[data-testid="golden-alert"]')).toBeHidden()
  await cards.nth(pair[1]).click()
  await page.clock.fastForward(100)
}

async function startGoldenPlaying(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0
  })
  await startPlaying(page)
  await completeCurrentBoard(page)
  await expect(page.locator('button.card-button')).toHaveCount(6)
  await completeCurrentBoard(page)
  await expect(page.locator('.board-layout')).toHaveAttribute('data-board-layout', '4x2')
  await attemptFirstPairBeforeGoldenEvent(page)
  await expect(page.locator('[data-testid="golden-alert"]')).toBeVisible()
  await expect(page.getByText('GOLDEN CAT!', { exact: true })).toBeVisible()
  await expect(page.getByText('เปิดแมวทอง แล้วหาคู่ให้ทันใน 5 วินาที!', { exact: true })).toBeVisible()
  await expect(page.locator('[data-testid="golden-alert"] .overlay-card')).toHaveCSS('background-image', /golden-alert-panel/)
  const frameBox = await page.locator('.game-frame').boundingBox()
  const alertBox = await page.locator('[data-testid="golden-alert"] .overlay-card').boundingBox()
  const alertCatBox = await page.locator('[data-testid="golden-alert"] .golden-alert-cat').boundingBox()
  expect(frameBox).not.toBeNull()
  expect(alertBox).not.toBeNull()
  expect(alertCatBox).not.toBeNull()
  expect(alertBox!.x).toBeGreaterThanOrEqual(frameBox!.x)
  expect(alertBox!.x + alertBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width)
  expect(alertBox!.y).toBeGreaterThanOrEqual(frameBox!.y)
  expect(alertBox!.y + alertBox!.height).toBeLessThanOrEqual(frameBox!.y + frameBox!.height)
  expect(Math.abs(alertBox!.width / alertBox!.height - 1)).toBeLessThan(0.03)
  expect(alertCatBox!.x).toBeGreaterThanOrEqual(alertBox!.x)
  expect(alertCatBox!.x + alertCatBox!.width).toBeLessThanOrEqual(alertBox!.x + alertBox!.width)
  expect(alertCatBox!.y).toBeGreaterThanOrEqual(alertBox!.y)
  expect(alertCatBox!.y + alertCatBox!.height).toBeLessThanOrEqual(alertBox!.y + alertBox!.height)
  await page.clock.fastForward(2500)
  await expect(page.locator('[data-testid="golden-timer"]')).toBeVisible()
}

async function startGoldenAlert(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0
  })
  await startPlaying(page)
  await completeCurrentBoard(page)
  await expect(page.locator('button.card-button')).toHaveCount(6)
  await completeCurrentBoard(page)
  await expect(page.locator('.board-layout')).toHaveAttribute('data-board-layout', '4x2')
  await attemptFirstPairBeforeGoldenEvent(page)
  await expect(page.locator('[data-testid="golden-alert"]')).toBeVisible()
}

async function expectFeedbackLayout(
  page: Page,
  label: string,
  frameBox: { x: number; y: number; width: number; height: number },
  scoreBoxBefore: { x: number; y: number; width: number; height: number },
) {
  await expect(page.getByText(label, { exact: true })).toBeVisible()
  const feedbackBox = await page.locator('.feedback-toast').boundingBox()
  const scoreBox = await page.locator('.hud-score').boundingBox()
  expect(feedbackBox).not.toBeNull()
  expect(scoreBox).not.toBeNull()
  expect(feedbackBox!.x).toBeGreaterThanOrEqual(frameBox.x)
  expect(feedbackBox!.x + feedbackBox!.width).toBeLessThanOrEqual(frameBox.x + frameBox.width)
  expect(feedbackBox!.y).toBeGreaterThanOrEqual(frameBox.y)
  expect(feedbackBox!.y + feedbackBox!.height).toBeLessThanOrEqual(frameBox.y + frameBox.height)
  expect(Math.abs(scoreBox!.x - scoreBoxBefore.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(scoreBox!.y - scoreBoxBefore.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(scoreBox!.width - scoreBoxBefore.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(scoreBox!.height - scoreBoxBefore.height)).toBeLessThanOrEqual(1)
}

for (const outcome of ['match', 'mismatch'] as const) {
  test(`paints ${outcome} feedback above overlapping cards on a short mobile screen`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 480 })
    await startPlaying(page)
    // Freeze the visual pose so the overlap check does not depend on animation timing.
    await page.addStyleTag({ content: '.feedback-toast, .card-button { animation: none !important; }' })
    const cards = page.locator('button.card-button')
    const groups = await cardGroups(page)
    await cards.nth(groups[0][0]).click()
    await cards.nth(outcome === 'match' ? groups[0][1] : groups[1][0]).click()
    const toast = page.locator(`.feedback-${outcome}`)
    await expect(toast).toBeVisible()
    const result = await toast.evaluate((element) => {
      const toastElement = element as HTMLElement
      const originalPointerEvents = toastElement.style.pointerEvents
      toastElement.style.pointerEvents = 'auto'
      const toastBox = toastElement.getBoundingClientRect()
      const overlaps = [...document.querySelectorAll('.card-button')].flatMap((card) => {
        const box = card.getBoundingClientRect()
        const left = Math.max(box.left, toastBox.left)
        const right = Math.min(box.right, toastBox.right)
        const top = Math.max(box.top, toastBox.top)
        const bottom = Math.min(box.bottom, toastBox.bottom)
        if (right <= left || bottom <= top) return []
        const topElement = document.elementFromPoint((left + right) / 2, (top + bottom) / 2)
        return [!!topElement && toastElement.contains(topElement)]
      })
      toastElement.style.pointerEvents = originalPointerEvents
      return overlaps
    })
    expect(result.length, 'the short screen must exercise overlapping cards').toBeGreaterThan(0)
    expect(result, 'feedback must be painted above every overlapping card').not.toContain(false)
    await expect(toast).toHaveCSS('pointer-events', 'none')
  })
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
  await page.clock.fastForward(2000)
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

test('keeps the HUD artwork at its original proportions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const expectedPanelRatio = 347 / 171
  const statBoxes = await page.locator('.hud-stat').evaluateAll((stats) =>
    stats.map((stat) => {
      const box = stat.getBoundingClientRect()
      return {
        ratio: box.width / box.height,
        backgroundSize: getComputedStyle(stat).backgroundSize,
      }
    }),
  )

  for (const box of statBoxes) {
    expect(Math.abs(box.ratio - expectedPanelRatio)).toBeLessThan(0.02)
    expect(box.backgroundSize).toBe('contain')
  }
})

test('finishes at zero and offers a replay result', async ({ page }) => {
  await startPlaying(page)
  await page.clock.runFor(110000)
  await expect(page.locator('.hud-time')).toHaveClass(/is-warning/)
  await page.clock.runFor(10000)

  await expect(page.getByText("Time's up")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible()
  await expect(page.locator('[data-testid="result-overlay"]')).toBeVisible()
  await expect(page.locator('.result-card')).toHaveCSS('background-image', /result-panel/)
  await expect(page.locator('.result-card h2')).toHaveText("Time's up")
  await expect(page.getByText('Nice work!', { exact: true })).toBeHidden()
  const resultBox = await page.locator('.result-card').boundingBox()
  expect(resultBox).not.toBeNull()
  expect(Math.abs(resultBox!.width / resultBox!.height - 1)).toBeLessThan(0.03)
  await expect(page.locator('.result-cat-card')).toBeVisible()
  await expect(page.locator('.result-cat-card')).toHaveAttribute('src', '/card/cat/cat-celebration.png')
  await expect(page.locator('.result-stat')).toHaveCount(3)
  await expect(page.locator('.result-grid strong').nth(0)).toHaveText('0')
  await expect(page.locator('.result-grid strong').nth(1)).toHaveText('0')
  await expect(page.locator('.result-grid strong').nth(2)).toHaveText('1')
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeVisible()
})

test('escalates the final-ten-second urgency without moving the Board', async ({ page }) => {
  await startPlaying(page)
  const board = page.locator('.board-layout')
  const boardBoxBefore = await board.boundingBox()

  await page.clock.runFor(110000)
  await expect(page.locator('[data-testid="urgency-vignette"]')).toHaveAttribute('data-urgency', 'warning')
  await expect(page.locator('.hud-time')).toHaveAttribute('data-warning-level', 'warning')

  await page.clock.runFor(7000)
  await expect(page.locator('[data-testid="urgency-vignette"]')).toHaveAttribute('data-urgency', 'critical')
  await expect(page.locator('.hud-time')).toHaveAttribute('data-warning-level', 'critical')

  const boardBoxAfter = await board.boundingBox()
  expect(boardBoxBefore).not.toBeNull()
  expect(boardBoxAfter).not.toBeNull()
  expect(Math.abs(boardBoxAfter!.x - boardBoxBefore!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(boardBoxAfter!.y - boardBoxBefore!.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(boardBoxAfter!.width - boardBoxBefore!.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(boardBoxAfter!.height - boardBoxBefore!.height)).toBeLessThanOrEqual(1)
})

test('scores Match and Mismatch through the visible Board', async ({ page }) => {
  await startPlaying(page)
  const cards = page.locator('button.card-button')
  const groups = await cardGroups(page)
  const frameBox = await page.locator('.game-frame').boundingBox()
  const scoreBoxBefore = await page.locator('.hud-score').boundingBox()
  expect(frameBox).not.toBeNull()
  expect(scoreBoxBefore).not.toBeNull()

  await cards.nth(groups[0][0]).click()
  await cards.nth(groups[1][0]).click()
  await expect(page.locator('.hud-score > strong')).toHaveText('0')
  await expectFeedbackLayout(page, 'MISMATCH!', frameBox!, scoreBoxBefore!)
  await page.clock.fastForward(700)

  await cards.nth(groups[0][0]).click()
  await cards.nth(groups[0][1]).click()
  await expect(page.locator('.hud-score > strong')).toHaveText('10')
  await expectFeedbackLayout(page, 'MATCH!', frameBox!, scoreBoxBefore!)
})

test('announces and locks the Golden Card Event before its Golden Timer begins', async ({ page }) => {
  await startGoldenPlaying(page)

  const alert = page.locator('[data-testid="golden-alert"]')
  await expect(alert).toBeHidden()
  await expect(page.getByText('GOLDEN CAT!', { exact: true })).toBeHidden()

  const goldenCard = page.locator('button.card-button[data-golden="true"]')
  await expect(goldenCard).toHaveCount(1)
  await expect(goldenCard).toHaveAttribute('aria-label', 'Golden card: open to find its pair')
  await expect(page.locator('[data-testid="golden-timer"]')).toHaveAttribute('data-timer-level', 'normal')

  const cards = page.locator('button.card-button')
  const disabledCards = await cards.evaluateAll((elements) => elements.filter((element) => (element as HTMLButtonElement).disabled).length)
  expect(disabledCards).toBe(7)

  await goldenCard.click()
  await expect(page.locator('button.card-button.is-revealed').filter({ has: page.locator('.golden-cover') })).toHaveCount(0)
  await expect(page.locator('button.card-button.is-revealed:not(.is-matched) .card-front img')).toHaveCount(1)
})

test('fits the Golden Card artwork to the card frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startGoldenPlaying(page)

  const goldenCard = page.locator('button.card-button[data-golden="true"]')
  await expect(goldenCard).toHaveCount(1)
  await expect(goldenCard.locator('.golden-cover img')).toHaveCSS('object-fit', 'cover')
})

test('awards the Golden Match bonus through the visible Board', async ({ page }) => {
  await startGoldenPlaying(page)
  const goldenCard = page.locator('button.card-button[data-golden="true"]')
  const goldenSource = await goldenCard.locator('.card-front img').getAttribute('src')
  expect(goldenSource).not.toBeNull()
  const matchingCard = page.locator(`button.card-button:not([data-golden="true"])`).filter({ has: page.locator(`.card-front img[src="${goldenSource}"]`) }).first()

  await goldenCard.click()
  await matchingCard.click()

  await expect(page.locator('.hud-score > strong')).toHaveText('75')
  await expect(page.getByText('GOLDEN MATCH!', { exact: true })).toBeVisible()
  await expect(page.getByText('+15 SCORE • +5s', { exact: true })).toBeVisible()
  await expect(page.locator('[data-testid="golden-timer"]')).toBeHidden()
})

test('penalizes a failed Golden Card Event without an extra Score loss', async ({ page }) => {
  await startGoldenPlaying(page)
  const goldenCard = page.locator('button.card-button[data-golden="true"]')
  const goldenSource = await goldenCard.locator('.card-front img').getAttribute('src')
  const wrongCard = page.locator('button.card-button:not(.is-matched):not([data-golden="true"])').filter({ hasNot: page.locator(`.card-front img[src="${goldenSource}"]`) }).first()

  await goldenCard.click()
  await wrongCard.click()

  await expect(page.getByText('GOLDEN MISSED!', { exact: true })).toBeVisible()
  await expect(page.getByText('-5s', { exact: true })).toBeVisible()
  await expect(page.locator('.hud-score > strong')).toHaveText('60')
  await page.clock.fastForward(700)
  await expect(page.locator('button.card-button.is-mismatch')).toHaveCount(0)
})

test('keeps the Golden Card Event available with reduced motion enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startGoldenPlaying(page)

  await expect(page.locator('.game-frame')).toHaveAttribute('data-motion', 'reduced')
  await expect(page.locator('button.card-button[data-golden="true"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="golden-timer"]')).toBeVisible()
  await expect(page.getByText('Golden Timer', { exact: true })).toBeVisible()
})

for (const viewport of [
  { name: 'portrait', width: 393, height: 852 },
  { name: 'small portrait', width: 320, height: 640 },
  { name: 'landscape', width: 851, height: 393 },
  { name: 'desktop', width: 1280, height: 720 },
]) {
  test(`keeps the Golden Alert and Golden Timer inside the game surface on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await startGoldenPlaying(page)

    const frameBox = await page.locator('.game-frame').boundingBox()
    const timerBox = await page.locator('[data-testid="golden-timer"]').boundingBox()
    expect(frameBox).not.toBeNull()
    expect(timerBox).not.toBeNull()
    expect(timerBox!.x).toBeGreaterThanOrEqual(frameBox!.x)
    expect(timerBox!.x + timerBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width)
    expect(timerBox!.y).toBeGreaterThanOrEqual(frameBox!.y)
    expect(timerBox!.y + timerBox!.height).toBeLessThanOrEqual(frameBox!.y + frameBox!.height)

    await page.getByRole('button', { name: 'Mute sound' }).click()
    await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible()
  })
}

test('pauses the Golden Alert and active Golden Timer on document visibility changes', async ({ page }) => {
  await startGoldenAlert(page)
  const alertTime = await page.locator('.hud-time > strong').textContent()

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByText('Game paused')).toBeVisible()
  await page.clock.fastForward(5000)
  await expect(page.locator('[data-testid="golden-alert"]')).toBeHidden()
  await expect(page.locator('.hud-time > strong')).toHaveText(alertTime ?? '')

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.fastForward(3000)
  await expect(page.locator('[data-testid="golden-alert"]')).toBeVisible()
  await page.clock.fastForward(2500)

  const goldenTimer = page.locator('[data-testid="golden-timer"]')
  const timerBeforePause = await goldenTimer.locator('strong').textContent()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.fastForward(5000)
  await expect(page.getByText('Game paused')).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.countdown-number')).toBeVisible()
  await expect(goldenTimer.locator('strong')).toHaveText(timerBeforePause ?? '')
})

test('celebrates a Match without blocking the next legal selection', async ({ page }) => {
  await startPlaying(page)
  const cards = page.locator('button.card-button')
  const groups = await cardGroups(page)

  await cards.nth(groups[0][0]).click()
  await cards.nth(groups[0][1]).click()

  await expect(page.locator('[data-testid="match-effect-layer"]')).toBeVisible()
  await expect(page.locator('.feedback-match')).toBeVisible()
  await expect(page.locator('button.card-button.is-matched')).toHaveCount(2)
  const effectTarget = await page.locator('[data-testid="match-effect-layer"]').evaluate((element) => ({
    x: Number.parseFloat(getComputedStyle(element).getPropertyValue('--target-x')),
    y: Number.parseFloat(getComputedStyle(element).getPropertyValue('--target-y')),
  }))
  const frameBox = await page.locator('.game-frame').boundingBox()
  const scoreBox = await page.locator('.hud-score').boundingBox()
  expect(frameBox).not.toBeNull()
  expect(scoreBox).not.toBeNull()
  expect(Math.abs((frameBox!.x + effectTarget.x) - (scoreBox!.x + scoreBox!.width / 2))).toBeLessThanOrEqual(2)
  expect(Math.abs((frameBox!.y + effectTarget.y) - (scoreBox!.y + scoreBox!.height / 2))).toBeLessThanOrEqual(2)

  const nextGroup = groups[1]
  await cards.nth(nextGroup[0]).click()
  await expect(cards.nth(nextGroup[0])).toHaveAttribute('aria-pressed', 'true')
})

test('gives a playful Mismatch reaction before hiding both cards', async ({ page }) => {
  await startPlaying(page)
  const cards = page.locator('button.card-button')
  const groups = await cardGroups(page)

  await cards.nth(groups[0][0]).click()
  await cards.nth(groups[1][0]).click()

  await expect(page.locator('button.card-button.is-mismatch')).toHaveCount(2)
  await expect(page.locator('.mismatch-mark')).toHaveCount(2)
  await expect(page.getByText('MISMATCH!', { exact: true })).toBeVisible()

  await page.clock.fastForward(700)
  await expect(page.locator('button.card-button.is-mismatch')).toHaveCount(0)
})

test('keeps outcome feedback available with reduced motion enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startPlaying(page)
  const cards = page.locator('button.card-button')
  const groups = await cardGroups(page)

  await expect(page.locator('.game-frame')).toHaveAttribute('data-motion', 'reduced')
  await cards.nth(groups[0][0]).click()
  await cards.nth(groups[0][1]).click()

  await expect(page.locator('[data-testid="match-effect-layer"]')).toHaveAttribute('data-motion', 'reduced')
  await expect(page.locator('.feedback-match')).toBeVisible()
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
  await expect(page.locator('.round-celebration')).toBeVisible()
  await expect(page.locator('.round-celebration-cat')).toBeVisible()
  await expect(page.locator('.round-celebration-cat')).toHaveAttribute('src', '/card/cat/cat-celebration.png')
  await expect(page.locator('.round-confetti-piece')).toHaveCount(10)
  await page.clock.fastForward(800)
  await expect(cards).toHaveCount(6)
  await expect(page.locator('.board-layout')).toHaveAttribute('data-board-layout', '3x2')
})

test('keeps every planned Board layout usable through Round 6', async ({ page }) => {
  await startPlaying(page)
  const expectedBoards = [
    { count: 4, layout: '2x2' },
    { count: 6, layout: '3x2' },
    { count: 8, layout: '4x2' },
    { count: 12, layout: '4x3' },
    { count: 16, layout: '4x4' },
    { count: 20, layout: '5x4' },
  ]

  let fourByTwoCardWidth: number | null = null
  let fourByTwoCardHeight: number | null = null

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

    if (expected.layout === '4x2') {
      fourByTwoCardWidth = lastCardBox!.width
      fourByTwoCardHeight = lastCardBox!.height
    }
    if (expected.layout === '4x3') {
      expect(fourByTwoCardWidth).not.toBeNull()
      expect(fourByTwoCardHeight).not.toBeNull()
      expect(lastCardBox!.width).toBeLessThan(fourByTwoCardWidth!)
      expect(lastCardBox!.height).toBeLessThan(fourByTwoCardHeight!)
    }

    if (index === expectedBoards.length - 1) break

    await completeCurrentBoard(page)
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

for (const viewport of [
  { name: 'portrait', width: 393, height: 852 },
  { name: 'small portrait', width: 320, height: 640 },
  { name: 'landscape', width: 851, height: 393 },
  { name: 'desktop', width: 1280, height: 720 },
]) {
  test(`keeps the 20-card Round usable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await advanceToFinalBoard(page)

    const frameBox = await page.locator('.game-frame').boundingBox()
    const firstCard = page.locator('button.card-button').first()
    const lastCard = page.locator('button.card-button').last()
    const firstCardBox = await firstCard.boundingBox()
    const lastCardBox = await lastCard.boundingBox()
    expect(frameBox).not.toBeNull()
    expect(firstCardBox).not.toBeNull()
    expect(lastCardBox).not.toBeNull()
    expect(firstCardBox!.width).toBeGreaterThanOrEqual(32)
    expect(firstCardBox!.x).toBeGreaterThanOrEqual(frameBox!.x)
    expect(lastCardBox!.x + lastCardBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width + 1)
    expect(lastCardBox!.y + lastCardBox!.height).toBeLessThanOrEqual(frameBox!.y + frameBox!.height + 1)

    await firstCard.click()
    await expect(firstCard).toHaveAttribute('aria-pressed', 'true')
  })
}

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
  await page.clock.install()
  await page.goto('/')
  const frame = page.locator('.game-frame')
  const box = await frame.boundingBox()

  expect(box).not.toBeNull()
  expect(Math.abs((box!.width / box!.height) - 9 / 16)).toBeLessThan(0.01)
  expect(Math.abs(box!.x + box!.width / 2 - 640)).toBeLessThan(2)

  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await page.clock.fastForward(4200)
  const firstCard = page.locator('button.card-button').first()
  await firstCard.click()
  await expect(firstCard).toHaveAttribute('aria-pressed', 'true')
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
  await expect(page.locator('.new-high-score')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeVisible()
  await expect(page.evaluate(() => window.localStorage.getItem('cat-card.high-score'))).resolves.toBe('10')
})
