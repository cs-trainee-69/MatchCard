import { CAT_CHARACTER_IDS, type CatCharacterId } from '../domain/catCharacters'

export const CHARACTER_IMAGES: Record<CatCharacterId, string> = Object.fromEntries(
  CAT_CHARACTER_IDS.map((id) => [id, `/card/cat/${id}.png`]),
) as Record<CatCharacterId, string>

export const CARD_BACK_IMAGE = '/card/cat-close.png'
export const GOLDEN_IMAGE = '/card/cat/golden-cat.png'
export const CELEBRATION_IMAGE = '/card/cat/cat-celebration.png'

export function imageSources(source: string): string {
  const base = source.replace(/\.png$/, '')
  return [256, 384, 512, 768].map((width) => `/optimized${base}-${width}.webp ${width}w`).join(', ')
}

const pendingImages = new Map<string, Promise<void>>()

function prepareImage(source: string, sizes: string, responsive = true): Promise<void> {
  const key = `${source}:${sizes}`
  const existing = pendingImages.get(key)
  if (existing) return existing
  const image = new Image()
  image.decoding = 'async'
  image.fetchPriority = 'low'
  const ready = new Promise<void>((resolve, reject) => {
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().then(resolve, reject)
      else resolve()
    }
    image.onerror = () => reject(new Error(`Unable to prepare ${source}`))
  }).catch(() => {
    // A preload failure must not prevent play; the displayed image can retry normally.
    pendingImages.delete(key)
  })
  pendingImages.set(key, ready)
  image.sizes = sizes
  if (responsive) image.srcset = imageSources(source)
  image.src = source
  return ready
}

export async function prepareGameImages(cardSizes: string): Promise<void> {
  const sources = [...Object.values(CHARACTER_IMAGES), CARD_BACK_IMAGE, GOLDEN_IMAGE]
  // Limit speculative loading so it does not compete with the current Board.
  let index = 0
  async function worker() {
    while (index < sources.length) await prepareImage(sources[index++], cardSizes)
  }
  await Promise.all([worker(), worker(), prepareImage(CELEBRATION_IMAGE, '130px')])
  const panelWidth = window.devicePixelRatio > 2 ? 1254 : window.devicePixelRatio > 1 ? 1024 : 512
  await Promise.all(['golden-alert-panel', 'result-panel'].map((name) =>
    prepareImage(`/optimized/ui/${name}-${panelWidth}.webp`, '', false),
  ))
}
