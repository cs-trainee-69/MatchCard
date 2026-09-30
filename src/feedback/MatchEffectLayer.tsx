import type { CSSProperties } from 'react'
import { PawIcon } from '../presentation/PawIcon'
import type { MatchEffect } from './types'

export function MatchEffectLayer({ effect, reducedMotion }: { effect: MatchEffect; reducedMotion: boolean }) {
  const style = {
    '--match-x': `${effect.sourceX}px`,
    '--match-y': `${effect.sourceY}px`,
    '--target-x': `${effect.targetX}px`,
    '--target-y': `${effect.targetY}px`,
    '--time-x': `${effect.timeX}px`,
    '--time-y': `${effect.timeY}px`,
    '--travel-x': `${effect.targetX - effect.sourceX}px`,
    '--travel-y': `${effect.targetY - effect.sourceY}px`,
  } as CSSProperties

  return (
    <div
      className={`match-effect-layer ${reducedMotion ? 'is-reduced-motion' : ''}`}
      data-testid="match-effect-layer"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      style={style}
      aria-hidden="true"
    >
      <span className="match-effect-burst">
        <span className="match-spark match-spark-one">✦</span>
        <span className="match-spark match-spark-two">✧</span>
        <span className="match-spark match-spark-three">✦</span>
        <span className="match-spark match-spark-four">•</span>
      </span>
      <span className="match-effect-paw">
        <PawIcon className="paw-icon" />
      </span>
      <span className="match-effect-impact" />
      {effect.isGolden && <span className="match-effect-impact match-effect-time-impact" />}
    </div>
  )
}
