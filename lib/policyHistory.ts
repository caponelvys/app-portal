// Policy change history helpers (M3 CP3). Every scoped allow/block change is
// appended to policy_changes as old → new; revert restores a change's prior
// value. Server-only (uses the service-role client).

import type { SupabaseClient } from '@supabase/supabase-js'

export type Scope = 'org' | 'location' | 'device' | 'ring'
export type Status = 'allowed' | 'blocked'

// The org that owns a scope target — for stamping/scoping the history list.
export async function scopeOrgId(admin: SupabaseClient, scope: string, scopeId: string): Promise<string | null> {
  if (scope === 'org') return scopeId
  const map: Record<string, [string, string]> = {
    location: ['locations', 'id'],
    device: ['devices', 'device_id'],
    ring: ['rings', 'id'],
  }
  const entry = map[scope]
  if (!entry) return null
  const { data } = await admin.from(entry[0]).select('org_id').eq(entry[1], scopeId).maybeSingle()
  return data?.org_id ?? null
}

// The current override status for (app, scope), or null when inherited.
export async function currentPolicyStatus(
  admin: SupabaseClient, appId: string, scope: string, scopeId: string,
): Promise<Status | null> {
  const { data } = await admin.from('app_policies')
    .select('status').eq('app_id', appId).eq('scope_type', scope).eq('scope_id', scopeId).maybeSingle()
  return (data?.status as Status | undefined) ?? null
}

export async function recordPolicyChange(admin: SupabaseClient, change: {
  scope_type: string; scope_id: string; app_id: string
  old_status: Status | null; new_status: Status | null
  org_id: string | null; changed_by: string
}): Promise<void> {
  await admin.from('policy_changes').insert(change)
}

// Set a scope's policy for an app to a target status (or clear to inherited when
// null). Used by both the editor and revert.
export async function applyPolicy(
  admin: SupabaseClient, appId: string, scope: string, scopeId: string, status: Status | null,
): Promise<void> {
  if (status === null) {
    await admin.from('app_policies').delete().eq('app_id', appId).eq('scope_type', scope).eq('scope_id', scopeId)
  } else {
    await admin.from('app_policies').upsert(
      { app_id: appId, scope_type: scope, scope_id: scopeId, status },
      { onConflict: 'app_id,scope_type,scope_id' },
    )
  }
}
