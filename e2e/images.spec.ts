import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 393, height: 852 },
  { width: 515, height: 897 },
  { width: 1280, height: 900 },
]) {
  test(`keeps the Start Prompt centered at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'แตะเพื่อเริ่ม' })).toBeVisible()
    await expect.poll(() => page.locator('.overlay-start').evaluate((overlay) => {
      const frame = overlay.getBoundingClientRect()
      const copy = overlay.querySelector('.start-floating-copy')!.getBoundingClientRect()
      return Math.abs(copy.y + copy.height / 2 - (frame.y + frame.height / 2))
    })).toBeLessThan(2)
  })
}

test('serves sharp, optimized images on a high-density display and after rotation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 })
  const page = await context.newPage()
  const failures: string[] = []
  page.on('response', (response) => { if (response.status() >= 400) failures.push(response.url()) })
  await page.goto('/')
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect(page.locator('.card-button').first()).toBeEnabled({ timeout: 10_000 })

  for (const viewport of [{ width: 393, height: 852 }, { width: 852, height: 393 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.locator('.card-face img').evaluateAll((images) => images.every((element) => {
      const image = element as HTMLImageElement
      const targetWidth = image.getBoundingClientRect().width * devicePixelRatio
      // Width descriptors make naturalWidth density-corrected; inspect the delivered width instead.
      const deliveredWidth = Number(image.currentSrc.match(/-(\d+)\.webp$/)?.[1] ?? 0)
      return image.complete && image.naturalWidth > 0 && deliveredWidth >= targetWidth * 1.07
    }))).toBe(true)
  }
  expect(failures).toEqual([])
  await context.close()
})

test('falls back to original card artwork when an optimized image cannot load', async ({ page }) => {
  await page.route('**/optimized/card/cat/cat-*.webp', (route) => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await expect.poll(() => page.locator('.card-front img').evaluateAll((images) => images.length > 0 && images.every((element) => {
    const image = element as HTMLImageElement
    return image.complete && image.naturalWidth > 0 && image.currentSrc.endsWith('.png')
  }))).toBe(true)
  const card = page.locator('.card-button').first()
  await expect(card).toBeEnabled({ timeout: 10_000 })
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
})
