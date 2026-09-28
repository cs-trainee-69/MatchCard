type SoundName = 'flip' | 'match' | 'mismatch' | 'warning' | 'finish'

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
  mismatch: { frequency: 180, duration: 0.13, type: 'sine', gain: 0.045 },
  warning: { frequency: 520, duration: 0.12, type: 'square', gain: 0.025 },
  finish: { frequency: 260, duration: 0.3, type: 'triangle', gain: 0.05 },
}

export function playSound(name: SoundName, enabled: boolean): void {
  if (!enabled) return

  const context = getAudioContext()
  if (!context) return

  const config = SOUND_CONFIG[name]
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime

  oscillator.type = config.type
  oscillator.frequency.setValueAtTime(config.frequency, now)
  gain.gain.setValueAtTime(config.gain, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + config.duration)
}
