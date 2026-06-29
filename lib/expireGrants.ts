import type { SupabaseClient } from '@supabase/supabase-js'

// Transition approved grants whose expiry has passed to 'expired'.
// Enforcement (agent) and portal display already check the timestamp in real
// time, so this is data hygiene: it keeps stored status accurate for history
// and admin views. Safe to call opportunistically or on a schedule.
export async function expireGrants(client: SupabaseClient): Promise<number> {
  const { data, error } = await client
    .from('app_requests')
    .update({ status: 'expired' })
    .eq('status', 'approved')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    console.error('[expireGrants]', error.message)
    return 0
  }
  return data?.length ?? 0
}
