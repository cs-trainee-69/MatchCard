import { PawIcon } from './PawIcon'

function SoundIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg className="sound-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 10v4h3l4 3V7l-4 3H4Z" />
      {enabled ? <path d="M15 9.5a4 4 0 0 1 0 5" /> : <path d="m16 9 5 6m0-6-5 6" />}
    </svg>
  )
}

export type GameFooterProps = {
  soundEnabled: boolean
  onToggleSound: () => void
}

export function GameFooter({ soundEnabled, onToggleSound }: GameFooterProps) {
  return (
    <div className="game-footer">
      <span className="footer-hint">
        <PawIcon className="paw-icon" />
        <span>Match the curious cats</span>
      </span>
      <button className="sound-button" type="button" onClick={onToggleSound} aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}>
        <SoundIcon enabled={soundEnabled} />
      </button>
    </div>
  )
}
