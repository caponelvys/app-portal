// Usage metering for billing. Live counts of enrolled vs active devices per org,
// and monthly snapshots for an auditable billing history. Server-only.

import type { SupabaseClient } from '@supabase/supabase-js'

export type OrgUsage = { org_id: string; total: number; active: number }

// 'YYYY-MM' for a date.
export function periodOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// First-of-month (UTC) for a date.
export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

// Live per-org counts: total enrolled, and active since `activeSince`.
export async function liveUsage(
  admin: SupabaseClient, orgIds: string[] | null, activeSince: Date,
): Promise<OrgUsage[]> {
  const { data } = await admin.rpc('usage_by_org', { p_org_ids: orgIds, p_active_since: activeSince.toISOString() })
  return ((data ?? []) as { org_id: string; total: number; active: number }[])
    .map(r => ({ org_id: r.org_id, total: Number(r.total), active: Number(r.active) }))
}

// Capture a period's snapshot for every org (upsert on org+period). `since`/
// `until` bound the "active" window; active = last_seen within it.
export async function captureSnapshots(
  admin: SupabaseClient, period: string, since: Date, until: Date,
): Promise<{ orgs: number }> {
  // total = enrolled now; active = checked in during the window.
  const { data: totals } = await admin.rpc('usage_by_org', { p_org_ids: null, p_active_since: since.toISOString() })
  const rows = ((totals ?? []) as { org_id: string; total: number; active: number }[])

  // Re-scope "active" to the window's upper bound when capturing a past month.
  const { data: windowed } = await admin.from('devices')
    .select('org_id, last_seen').gte('last_seen', since.toISOString()).lt('last_seen', until.toISOString())
  const activeInWindow = new Map<string, number>()
  for (const d of windowed ?? []) {
    if (d.org_id) activeInWindow.set(d.org_id, (activeInWindow.get(d.org_id) ?? 0) + 1)
  }

  const snapshots = rows.map(r => ({
    org_id: r.org_id, period,
    device_count: Number(r.total),
    active_count: activeInWindow.get(r.org_id) ?? 0,
  }))
  if (snapshots.length) {
    await admin.from('usage_snapshots').upsert(snapshots, { onConflict: 'org_id,period' })
  }
  return { orgs: snapshots.length }
}
