import type { Entry, RoundClient } from './gameCenter'

// Development adapter only. It never makes requests or creates central sessions.
export function createLocalEntry(): Entry {
  const client = (): RoundClient => ({
    finish: async () => ({ status: 'accepted', rankingEligible: false }),
  })
  return {
    access: async () => client(),
    beginRound: async () => client(),
    signIn: () => {},
  }
}
