// A device is "online" if its agent has checked in recently. The agent sends a
// heartbeat every 5s, so a couple of minutes of slack avoids false offlines.
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

export function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS
}

// ISO cutoff before which a device counts as offline. Used for DB-side filtering.
export function offlineThresholdIso(): string {
  return new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString()
}
