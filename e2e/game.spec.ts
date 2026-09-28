import { expect, test } from '@playwright/test'

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

  await page.locator('button.card-button').first().click()
  await expect(page.locator('button.card-button').first()).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Mute sound' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible()
})

test('finishes at zero and offers a replay result', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Tap to start' }).click()
  await expect(page.getByText('Get ready')).toBeVisible()
  await page.clock.fastForward(3000)
  await expect(page.getByText('Get ready')).toBeHidden()
  await page.clock.runFor(120000)

  await expect(page.getByText("Time's up")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible()
})
