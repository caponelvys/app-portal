import type { SupabaseClient } from '@supabase/supabase-js'

export type RoleV2 = 'msp_admin' | 'msp_tech' | 'client_admin' | 'client_user'

export interface CallerProfile {
  id: string
  role: string          // legacy: 'admin' | 'user'
  role_v2: RoleV2
  org_id: string | null
}

/** Load the caller's profile. Returns null if unauthenticated. */
export async function getCallerProfile(supabase: SupabaseClient): Promise<CallerProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, role_v2, org_id')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // Treat legacy admin as msp_admin when role_v2 column not yet migrated
  const effectiveRole: RoleV2 = profile.role_v2 ?? (profile.role === 'admin' ? 'msp_admin' : 'client_user')
  return { ...profile, role_v2: effectiveRole }
}

/** Returns true if the caller can see all orgs (MSP staff). */
export function isMspStaff(profile: CallerProfile): boolean {
  return profile.role_v2 === 'msp_admin' || profile.role_v2 === 'msp_tech' || profile.role === 'admin'
}

/**
 * Returns the list of org IDs the caller can access.
 * msp_admin / legacy admin → null (means "all orgs")
 * msp_tech                → orgs from memberships table
 * client_admin/user       → own org only
 */
export async function getAccessibleOrgIds(
  supabase: SupabaseClient,
  profile: CallerProfile,
): Promise<string[] | null> {
  if (profile.role === 'admin' || profile.role_v2 === 'msp_admin') {
    return null // all orgs
  }

  if (profile.role_v2 === 'msp_tech') {
    const { data: memberships } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', profile.id)
    return (memberships ?? []).map(m => m.org_id)
  }

  // client_admin or client_user — own org only
  if (profile.org_id) return [profile.org_id]
  return []
}
