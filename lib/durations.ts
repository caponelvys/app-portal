// Shared duration options for temporary app-access grants.
// `ms` is the grant length; null means a permanent (never-expiring) grant.
export const DURATIONS = [
  { code: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { code: '4h', label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { code: '1d', label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { code: '1w', label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
  { code: 'permanent', label: 'Permanent', ms: null },
] as const

export type DurationCode = (typeof DURATIONS)[number]['code']

export function isValidDuration(code: string): boolean {
  return DURATIONS.some(d => d.code === code)
}

export function durationLabel(code: string): string {
  return DURATIONS.find(d => d.code === code)?.label ?? code
}

// Returns an ISO expiry timestamp for the given duration, or null for permanent.
export function expiryFromDuration(code: string): string | null {
  const d = DURATIONS.find(x => x.code === code)
  if (!d || d.ms == null) return null
  return new Date(Date.now() + d.ms).toISOString()
}

// True when a grant with this status/expiry is currently usable.
export function isGrantActive(status: string, expiresAt: string | null): boolean {
  if (status !== 'approved') return false
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() > Date.now()
}

// Short human label for time remaining, e.g. "3h left" or "Expires soon".
export function expiresInLabel(expiresAt: string | null): string {
  if (!expiresAt) return 'Permanent'
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours >= 48) return `${Math.floor(hours / 24)}d left`
  if (hours >= 1) return `${hours}h left`
  const mins = Math.max(1, Math.floor(ms / (60 * 1000)))
  return `${mins}m left`
}
