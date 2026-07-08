import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAccessibleOrgIds, type CallerProfile } from '@/lib/rbac'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const CHUNK = 500

export const COMMAND_SCOPES = ['device', 'location', 'org', 'fleet'] as const
export type CommandScope = (typeof COMMAND_SCOPES)[number]
export type CommandType = 'install_app' | 'uninstall_app' | 'elevate_app'

type Result =
  | { ok: true; queued: number; app: string }
  | { ok: false; status: number; error: string }

// Shared enqueue for portal-issued app commands (install/uninstall). Resolves the
// target device set for the scope, enforcing the caller's org access, and inserts
// one device_commands row per device (chunked). Caller must have already verified
// MSP-staff. The agent picks the rows up and writes results back.
export async function enqueueAppCommand(opts: {
  appId: string
  type: CommandType
  scope: CommandScope
  scopeId?: string
  profile: CallerProfile
  supabase: SupabaseClient
}): Promise<Result> {
  const { appId, type, scope, scopeId, profile, supabase } = opts

  const admin = createAdminClient()
  const { data: app } = await admin.from('apps').select('id, name').eq('id', appId).single()
  if (!app) return { ok: false, status: 404, error: 'App not found' }

  const orgIds = await getAccessibleOrgIds(supabase, profile)  // null = all orgs
  const accessible = (oid: string | null | undefined) => orgIds === null || (!!oid && orgIds.includes(oid))

  let devices: { device_id: string; org_id: string | null }[] = []
  if (scope === 'device') {
    if (!scopeId) return { ok: false, status: 400, error: 'scopeId is required' }
    const { data: d } = await admin.from('devices').select('device_id, org_id').eq('device_id', scopeId).single()
    if (!d) return { ok: false, status: 404, error: 'Device not found' }
    if (!accessible(d.org_id)) return { ok: false, status: 403, error: 'Forbidden' }
    devices = [d]
  } else if (scope === 'org') {
    if (!scopeId) return { ok: false, status: 400, error: 'scopeId is required' }
    if (!accessible(scopeId)) return { ok: false, status: 403, error: 'Forbidden' }
    const { data } = await admin.from('devices').select('device_id, org_id').eq('org_id', scopeId)
    devices = data ?? []
  } else if (scope === 'location') {
    if (!scopeId) return { ok: false, status: 400, error: 'scopeId is required' }
    const { data: loc } = await admin.from('locations').select('id, org_id').eq('id', scopeId).single()
    if (!loc) return { ok: false, status: 404, error: 'Location not found' }
    if (!accessible(loc.org_id)) return { ok: false, status: 403, error: 'Forbidden' }
    const { data } = await admin.from('devices').select('device_id, org_id').eq('location_id', scopeId)
    devices = data ?? []
  } else {
    let dq = admin.from('devices').select('device_id, org_id')
    if (orgIds !== null) dq = dq.in('org_id', orgIds.length ? orgIds : [NO_MATCH])
    const { data } = await dq
    devices = data ?? []
  }

  if (!devices.length) return { ok: true, queued: 0, app: app.name }

  const rows = devices.map(d => ({
    device_id: d.device_id, type, app_id: appId, org_id: d.org_id, created_by: profile.id,
  }))
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin.from('device_commands').insert(rows.slice(i, i + CHUNK))
    if (error) return { ok: false, status: 400, error: error.message }
  }
  return { ok: true, queued: rows.length, app: app.name }
}
