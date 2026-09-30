import { type Card, getBoardLayout, type GameState } from '../domain/gameSession'
import type { GameConfig } from '../domain/gameConfig'
import type { CatCharacterId } from '../domain/catCharacters'

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

const CHARACTER_IMAGES: Record<CatCharacterId, string> = {
  'cat-1': '/card/cat/cat-1.png',
  'cat-2': '/card/cat/cat-2.png',
  'cat-3': '/card/cat/cat-3.png',
  'cat-4': '/card/cat/cat-4.png',
  'cat-5': '/card/cat/cat-5.png',
  'cat-6': '/card/cat/cat-6.png',
  'cat-7': '/card/cat/cat-7.png',
  'cat-8': '/card/cat/cat-8.png',
  'cat-9': '/card/cat/cat-9.png',
  'cat-10': '/card/cat/cat-10.png',
}

type CardButtonProps = {
  card: Card
  index: number
  disabled: boolean
  isMismatch: boolean
  isGolden: boolean
  goldenSelectionLocked: boolean
  cardRef: (element: HTMLButtonElement | null) => void
  onSelect: (cardId: string) => void
}

function CardButton({
  card,
  index,
  disabled,
  isMismatch,
  isGolden,
  goldenSelectionLocked,
  cardRef,
  onSelect,
}: CardButtonProps) {
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
        <img src="/card/cat-close.png" alt="" />
      </span>
      {isGoldenCoverVisible && (
        <span className="card-face golden-cover" aria-hidden="true">
          <img src="/card/cat/golden-cat.png" alt="" />
        </span>
      )}
      <span className="card-face card-front" aria-hidden="true">
        <img src={CHARACTER_IMAGES[card.character]} alt="" />
      </span>
      {isMismatch && <span className="mismatch-mark" aria-hidden="true">!?</span>}
    </button>
  )
}

export type BoardProps = {
  state: GameState
  config: GameConfig
  onSelect: (cardId: string) => void
  registerCardRef: (cardId: string, element: HTMLButtonElement | null) => void
}

export function Board({ state, config, onSelect, registerCardRef }: BoardProps) {
  const boardLayout = getBoardLayout(state.round, config)
  const cardsDisabled = state.phase !== 'playing' && state.phase !== 'golden-playing'
  const goldenSelectionLocked = state.phase === 'golden-playing' && state.selectedCardIds.length === 0

  if (state.board.length === 0) return <div className="board-wrap" />

  return (
    <div className="board-wrap">
      <div
        className="board-layout"
        data-board-layout={`${boardLayout.rows}x${boardLayout.columns}`}
        style={{ gridTemplateColumns: `repeat(${boardLayout.columns}, minmax(0, 1fr))` }}
      >
        {state.board.map((card, index) => (
          <CardButton
            key={card.id}
            card={card}
            index={index}
            disabled={cardsDisabled}
            isMismatch={
              (state.phase === 'resolving-mismatch' || state.phase === 'golden-resolving-mismatch') &&
              state.selectedCardIds.includes(card.id)
            }
            isGolden={
              (state.goldenEventStatus === 'alert' || state.goldenEventStatus === 'active') &&
              state.goldenCardId === card.id
            }
            goldenSelectionLocked={goldenSelectionLocked}
            cardRef={(element) => registerCardRef(card.id, element)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
