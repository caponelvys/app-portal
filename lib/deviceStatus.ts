export const HEALTHY_MS  = 2  * 60 * 1000                // < 2 min  → Healthy
export const INACTIVE_MS = 14 * 24 * 60 * 60 * 1000      // < 14 days → Inactive
export const WARNING_MS  = 30 * 24 * 60 * 60 * 1000      // < 30 days → Warning
export const STALE_MS    = 90 * 24 * 60 * 60 * 1000      // < 90 days → Stale
                                                           // ≥ 90 days → Lost

export type HealthTier = 'healthy' | 'inactive' | 'warning' | 'stale' | 'lost' | 'never'

export function getHealthTier(lastSeen: string | null): HealthTier {
  if (!lastSeen) return 'never'
  const age = Date.now() - new Date(lastSeen).getTime()
  if (age < HEALTHY_MS)  return 'healthy'
  if (age < INACTIVE_MS) return 'inactive'
  if (age < WARNING_MS)  return 'warning'
  if (age < STALE_MS)    return 'stale'
  return 'lost'
}

export const TIER_LABEL: Record<HealthTier, string> = {
  healthy:  'Healthy',
  inactive: 'Inactive',
  warning:  'Warning',
  stale:    'Stale',
  lost:     'Lost',
  never:    'Never seen',
}

export const TIER_COLOR: Record<HealthTier, string> = {
  healthy:  'text-green-400',
  inactive: 'text-yellow-400',
  warning:  'text-orange-400',
  stale:    'text-red-400',
  lost:     'text-red-600',
  never:    'text-gray-500',
}

export const TIER_DOT: Record<HealthTier, string> = {
  healthy:  'bg-green-400',
  inactive: 'bg-yellow-400',
  warning:  'bg-orange-400',
  stale:    'bg-red-400',
  lost:     'bg-red-600',
  never:    'bg-gray-600',
}

// Legacy helpers kept for existing callers
export const ONLINE_THRESHOLD_MS = HEALTHY_MS

export function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < HEALTHY_MS
}

export function offlineThresholdIso(): string {
  return new Date(Date.now() - HEALTHY_MS).toISOString()
}
