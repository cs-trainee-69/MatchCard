const HIGH_SCORE_KEY = 'cat-card.high-score'
const SOUND_ENABLED_KEY = 'cat-card.sound-enabled'

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Persistence is a convenience; private browsing must not break play.
  }
}

export function loadHighScore(): number {
  const stored = Number(readStorage(HIGH_SCORE_KEY))
  return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
}

export function saveHighScore(score: number): void {
  writeStorage(HIGH_SCORE_KEY, String(Math.max(0, Math.floor(score))))
}

export function loadSoundEnabled(): boolean {
  const stored = readStorage(SOUND_ENABLED_KEY)
  return stored === null ? true : stored === 'true'
}

export function saveSoundEnabled(enabled: boolean): void {
  writeStorage(SOUND_ENABLED_KEY, String(enabled))
}
