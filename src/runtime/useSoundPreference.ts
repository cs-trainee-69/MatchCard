import { useCallback, useState } from 'react'
import { loadSoundEnabled, saveSoundEnabled } from '../storage'

export function useSoundPreference() {
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled)

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => {
      const next = !enabled
      saveSoundEnabled(next)
      return next
    })
  }, [])

  return { soundEnabled, toggleSound }
}
