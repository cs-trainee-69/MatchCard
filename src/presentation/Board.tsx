import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type Card, getBoardLayout, type GameState } from '../domain/gameSession'
import type { GameConfig } from '../domain/gameConfig'
import type { CatCharacterId } from '../domain/catCharacters'
import { GameImage } from './GameImage'
import { CARD_BACK_IMAGE, CHARACTER_IMAGES, GOLDEN_IMAGE, prepareGameImages } from './gameImages'

const CHARACTER_LABELS: Record<CatCharacterId, string> = {
  'cat-1': 'Cat 1',
  'cat-2': 'Cat 2',
  'cat-3': 'Cat 3',
  'cat-4': 'Cat 4',
  'cat-5': 'Cat 5',
  'cat-6': 'Cat 6',
  'cat-7': 'Cat 7',
  'cat-8': 'Cat 8',
  'cat-9': 'Cat 9',
  'cat-10': 'Cat 10',
}

type CardButtonProps = {
  card: Card
  index: number
  disabled: boolean
  isMismatch: boolean
  isGolden: boolean
  goldenSelectionLocked: boolean
  registerCardRef: (cardId: string, element: HTMLButtonElement | null) => void
  imageSizes: string
  onSelect: (cardId: string) => void
}

const CardButton = memo(function CardButton({
  card,
  index,
  disabled,
  isMismatch,
  isGolden,
  goldenSelectionLocked,
  registerCardRef,
  imageSizes,
  onSelect,
}: CardButtonProps) {
  const cardRef = useCallback((element: HTMLButtonElement | null) => {
    registerCardRef(card.id, element)
  }, [card.id, registerCardRef])
  const isHidden = card.status === 'hidden'
  const isMatched = card.status === 'matched'
  const isGoldenCoverVisible = isGolden && isHidden
  const isDisabled = disabled || isMatched || (goldenSelectionLocked && !isGolden)
  const label = isGoldenCoverVisible
    ? 'Golden card: open to find its pair'
    : isHidden
      ? `Hidden card ${index + 1}`
      : `${CHARACTER_LABELS[card.character]} cat card`

  return (
    <button
      ref={cardRef}
      className={`card-button ${isHidden ? '' : 'is-revealed'} ${isMatched ? 'is-matched' : ''} ${isMismatch ? 'is-mismatch' : ''} ${isGoldenCoverVisible ? 'is-golden' : ''}`}
      type="button"
      aria-label={label}
      aria-pressed={!isHidden}
      data-golden={isGolden ? 'true' : undefined}
      disabled={isDisabled}
      onClick={() => onSelect(card.id)}
    >
      <span className="card-face card-back" aria-hidden="true">
        <GameImage src={CARD_BACK_IMAGE} sizes={imageSizes} alt="" />
      </span>
      {isGoldenCoverVisible && (
        <span className="card-face golden-cover" aria-hidden="true">
          <GameImage src={GOLDEN_IMAGE} sizes={imageSizes} alt="" />
        </span>
      )}
      <span className="card-face card-front" aria-hidden="true">
        <GameImage src={CHARACTER_IMAGES[card.character]} sizes={imageSizes} alt="" />
      </span>
      {isMismatch && <span className="mismatch-mark" aria-hidden="true">!?</span>}
    </button>
  )
})

export type BoardProps = {
  cards: GameState['board']
  round: GameState['round']
  phase: GameState['phase']
  selectedCardIds: GameState['selectedCardIds']
  goldenEventStatus: GameState['goldenEventStatus']
  goldenCardId: GameState['goldenCardId']
  config: GameConfig
  onSelect: (cardId: string) => void
  registerCardRef: (cardId: string, element: HTMLButtonElement | null) => void
}

export const Board = memo(function Board({
  cards, round, phase, selectedCardIds, goldenEventStatus, goldenCardId,
  config, onSelect, registerCardRef,
}: BoardProps) {
  const boardLayout = getBoardLayout(round, config)
  const cardsDisabled = phase !== 'playing' && phase !== 'golden-playing'
  const goldenSelectionLocked = phase === 'golden-playing' && selectedCardIds.length === 0
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const warmedImages = useRef(false)
  const [imageWidth, setImageWidth] = useState<number | null>(null)
  const imageSizes = `${imageWidth ?? Math.ceil(360 / boardLayout.columns)}px`

  useLayoutEffect(() => {
    const layout = layoutRef.current
    if (!layout) return
    const measure = () => {
      const card = layout.querySelector('.card-button')
      const width = card?.getBoundingClientRect().width ?? 0
      if (width > 0) setImageWidth(Math.ceil(width * 1.07))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(layout)
    return () => observer.disconnect()
  }, [boardLayout.columns, boardLayout.rows, cards.length])

  useEffect(() => {
    if (imageWidth === null || warmedImages.current) return
    warmedImages.current = true
    void prepareGameImages(imageSizes)
  }, [imageWidth, imageSizes])

  if (cards.length === 0) return <div className="board-wrap" />

  return (
    <div className="board-wrap">
      <div
        ref={layoutRef}
        className="board-layout"
        data-board-layout={`${boardLayout.rows}x${boardLayout.columns}`}
        style={{ gridTemplateColumns: `repeat(${boardLayout.columns}, minmax(0, 1fr))` }}
      >
        {cards.map((card, index) => (
          <CardButton
            key={card.id}
            card={card}
            index={index}
            disabled={cardsDisabled}
            isMismatch={
              (phase === 'resolving-mismatch' || phase === 'golden-resolving-mismatch') &&
              selectedCardIds.includes(card.id)
            }
            isGolden={
              (goldenEventStatus === 'alert' || goldenEventStatus === 'active') &&
              goldenCardId === card.id
            }
            goldenSelectionLocked={goldenSelectionLocked}
            registerCardRef={registerCardRef}
            imageSizes={imageSizes}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
})
