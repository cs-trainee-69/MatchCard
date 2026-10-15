import { expect, test } from '@playwright/test'

test('npm dev plays and replays without central sign-in or score traffic', async ({ page }) => {
  test.setTimeout(60000)
  const centralRequests: string[] = []
  await page.route('https://center.game.gamification.in.th/**', route => {
    centralRequests.push(route.request().url())
    return route.abort()
  })
  await page.clock.install()
  await page.goto('/')
  await expect(page.getByText('โหมดพัฒนา · เล่นในเครื่อง ไม่ส่งคะแนนจริง')).toBeVisible()
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect(page.locator('.countdown-number')).toBeVisible()
  await page.clock.runFor(5500)
  const card = page.locator('.card-button').first()
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await page.clock.runFor(121000)
  await expect(page.getByText('ผลทดสอบในเครื่อง · ไม่ส่งคะแนนจริง')).toBeVisible()
  await page.getByRole('button', { name: 'ดูอันดับออนไลน์' }).click()
  await expect(page.getByRole('dialog')).toContainText('โหมดพัฒนาไม่โหลดอันดับจริง')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'เล่นอีกครั้ง' }).click()
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect(page.locator('.countdown-number')).toBeVisible()
  expect(new URL(page.url()).hostname).toBe('127.0.0.1')
  expect(centralRequests).toEqual([])
})
