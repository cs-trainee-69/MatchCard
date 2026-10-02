import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
import { resolvePort } from '../config/ports.mjs'

const fileEnv = loadEnv('development', process.cwd(), '')
const port = resolvePort(process.env.PORT, fileEnv.PORT, 'PORT', 5173)
const url = process.env.PERF_URL ?? `http://127.0.0.1:${port}`
const cpuSlowdown = Number(process.env.PERF_CPU_SLOWDOWN ?? 1)
if (!Number.isFinite(cpuSlowdown) || cpuSlowdown < 1) throw new Error('PERF_CPU_SLOWDOWN must be a number >= 1')
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 })
  await page.addInitScript(() => { Math.random = () => 0 })
  const client = await page.context().newCDPSession(page)
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown })
  const failures = []
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
  })
  const started = Date.now()
  await page.goto(url, { waitUntil: 'networkidle' })
  const readyMs = Date.now() - started
  await page.getByRole('button', { name: 'แตะเพื่อเริ่ม' }).click()
  await page.waitForFunction(() => document.querySelector('.card-button:not(:disabled)'))
  const rounds = []
  for (let round = 1; round <= 6; round += 1) {
    await page.waitForFunction((count) => document.querySelectorAll('.card-button').length === count, [4, 6, 8, 12, 16, 20][round - 1])
    rounds.push(await page.locator('.card-front img').evaluateAll((images) => ({
      count: images.length,
      widths: images.map((img) => Math.round(img.getBoundingClientRect().width)),
      sources: [...new Set(images.map((img) => img.currentSrc))],
      decoded: images.every((img) => img.complete && img.naturalWidth > 0),
    })))
    if (round === 6) break
    const groups = await page.locator('.card-front img').evaluateAll((images) => {
      const pairs = new Map()
      images.forEach((img, index) => pairs.set(img.getAttribute('src'), [...(pairs.get(img.getAttribute('src')) ?? []), index]))
      return [...pairs.values()]
    })
    for (const [first, second] of groups) {
      await page.locator('.card-button').nth(first).click()
      await page.locator('.card-button').nth(second).click()
    }
  }
  const frames = await page.evaluate(() => new Promise((resolve) => {
    const samples = []
    let previous
    const start = performance.now()
    function frame(now) {
      if (previous !== undefined) samples.push(now - previous)
      previous = now
      if (now - start < 2500) requestAnimationFrame(frame)
      else {
        samples.sort((a, b) => a - b)
        resolve({ count: samples.length, p95Ms: samples[Math.floor(samples.length * 0.95)], over33Ms: samples.filter((ms) => ms > 33.4).length })
      }
    }
    requestAnimationFrame(frame)
  }))
  const images = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => /\.(png|webp)(\?|$)/.test(entry.name))
    .map((entry) => ({ path: new URL(entry.name).pathname, bytes: entry.encodedBodySize })))
  // Sample actual flips, a Mismatch, and consecutive Matches on the largest Board.
  // Keep normal browser time: virtual clocks cannot measure animation smoothness.
  await page.evaluate(() => {
    window.__perfFrames = { samples: [], previous: null, running: true }
    const frame = (now) => {
      const capture = window.__perfFrames
      if (!capture.running) return
      if (capture.previous !== null) capture.samples.push(now - capture.previous)
      capture.previous = now
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
  const finalGroups = await page.locator('.card-front img').evaluateAll((images) => {
    const pairs = new Map()
    images.forEach((img, index) => pairs.set(img.getAttribute('src'), [...(pairs.get(img.getAttribute('src')) ?? []), index]))
    return [...pairs.values()]
  })
  await page.locator('.card-button').nth(finalGroups[0][0]).click()
  await page.locator('.card-button').nth(finalGroups[1][0]).click()
  await page.waitForFunction(() => !document.querySelector('.card-button.is-revealed'))
  // Leave one pair unselected so this sample stays on the twenty-card Board.
  for (const [first, second] of finalGroups.slice(0, -1)) {
    await page.locator('.card-button').nth(first).click()
    await page.locator('.card-button').nth(second).click()
    await page.waitForTimeout(800)
  }
  const activeFrames = await page.evaluate(() => {
    const capture = window.__perfFrames
    capture.running = false
    const samples = capture.samples.sort((a, b) => a - b)
    delete window.__perfFrames
    return {
      count: samples.length,
      p95Ms: samples[Math.floor(samples.length * 0.95)],
      maxMs: samples.at(-1),
      over33Ms: samples.filter((ms) => ms > 33.4).length,
    }
  })
  if (process.env.PERF_SCREENSHOT) {
    await page.locator('.card-button:not(:disabled)').first().click()
    await page.locator('.card-front img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())))
    await page.screenshot({ path: process.env.PERF_SCREENSHOT })
  }
  const result = { url, viewport: '393x852 @3x, headless Chromium; unthrottled local network', cpuSlowdown, readyMs, rounds, frames, activeFrames, imageBytes: images.reduce((sum, image) => sum + image.bytes, 0), images, failures }
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
  if (failures.length || rounds.some((round) => !round.decoded)) process.exitCode = 1
} finally {
  await browser.close()
}
