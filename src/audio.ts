type SoundName =
  | 'flip'
  | 'match'
  | 'match-impact'
  | 'mismatch'
  | 'warning'
  | 'round-complete'
  | 'finish'
  | 'golden-alert'
  | 'golden-tick'
  | 'golden-match'
  | 'golden-missed'

type SoundOptions = { urgent?: boolean }

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) {
    return null
  }

  audioContext ??= new window.AudioContext()
  return audioContext
}

const SOUND_CONFIG: Record<SoundName, { frequency: number; duration: number; type: OscillatorType; gain: number }> = {
  flip: { frequency: 420, duration: 0.055, type: 'sine', gain: 0.035 },
  match: { frequency: 660, duration: 0.16, type: 'triangle', gain: 0.06 },
  'match-impact': { frequency: 980, duration: 0.1, type: 'sine', gain: 0.035 },
  mismatch: { frequency: 180, duration: 0.13, type: 'sine', gain: 0.045 },
  warning: { frequency: 520, duration: 0.12, type: 'square', gain: 0.025 },
  'round-complete': { frequency: 660, duration: 0.16, type: 'triangle', gain: 0.05 },
  finish: { frequency: 260, duration: 0.3, type: 'triangle', gain: 0.05 },
  'golden-alert': { frequency: 880, duration: 0.22, type: 'triangle', gain: 0.065 },
  'golden-tick': { frequency: 760, duration: 0.08, type: 'square', gain: 0.028 },
  'golden-match': { frequency: 1040, duration: 0.2, type: 'triangle', gain: 0.07 },
  'golden-missed': { frequency: 150, duration: 0.18, type: 'sawtooth', gain: 0.045 },
}

let matchVariant = 0

function playTone(
  context: AudioContext,
  config: { frequency: number; duration: number; type: OscillatorType; gain: number },
  options: SoundOptions = {},
): void {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime
  const intensity = options.urgent ? 1.16 : 1
  const frequency = config.frequency * (options.urgent ? 1.12 : 1)

  oscillator.type = config.type
  oscillator.frequency.setValueAtTime(frequency, now)
  gain.gain.setValueAtTime(config.gain * intensity, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + config.duration)
}

export function playSound(name: SoundName, enabled: boolean, options: SoundOptions = {}): void {
  if (!enabled) return

  const context = getAudioContext()
  if (!context) return

  const config = SOUND_CONFIG[name]

  if (name === 'match') {
    const variants = [660, 700, 620]
    const matchConfig = { ...config, frequency: variants[matchVariant % variants.length] }
    matchVariant += 1
    playTone(context, matchConfig, options)
    return
  }

  if (name === 'round-complete') {
    ;[660, 780, 980].forEach((frequency, index) => {
      window.setTimeout(() => playTone(context, { ...config, frequency, duration: 0.18 }, options), index * 85)
    })
    return
  }

  playTone(context, config, options)
}
