// Policy template helpers (M3 CP4). A template is a reusable set of app→status
// entries; capture snapshots a scope's current overrides into a template, apply
// writes them onto a scope (logging to history). Server-only (service-role).

import type { SupabaseClient } from '@supabase/supabase-js'
import { scopeOrgId, currentPolicyStatus, recordPolicyChange, applyPolicy, type Status } from '@/lib/policyHistory'

// Snapshot a scope's current allow/block overrides as template items.
export async function captureScopeItems(
  admin: SupabaseClient, scope: string, scopeId: string,
): Promise<{ app_id: string; status: Status }[]> {
  const { data } = await admin.from('app_policies')
    .select('app_id, status').eq('scope_type', scope).eq('scope_id', scopeId)
  return (data ?? []).map(p => ({ app_id: p.app_id as string, status: p.status as Status }))
}

// Apply a template's items to a scope: upsert each as an app_policy and log the
// change (only when it actually changed), so templates show up in history too.
export async function applyTemplate(
  admin: SupabaseClient, templateId: string, scope: string, scopeId: string, actorId: string,
): Promise<{ applied: number }> {
  const { data: items } = await admin.from('policy_template_items')
    .select('app_id, status').eq('template_id', templateId)
  const org = await scopeOrgId(admin, scope, scopeId)

  let applied = 0
  for (const item of items ?? []) {
    const status = item.status as Status
    const before = await currentPolicyStatus(admin, item.app_id, scope, scopeId)
    if (before === status) continue
    await applyPolicy(admin, item.app_id, scope, scopeId, status)
    await recordPolicyChange(admin, {
      scope_type: scope, scope_id: scopeId, app_id: item.app_id,
      old_status: before, new_status: status, org_id: org, changed_by: actorId,
    })
    applied++
  }
  return { applied }
}
