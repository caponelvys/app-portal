import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { authenticateDevice } from '@/lib/agentAuth'

// One authenticated round-trip per agent cycle. Replaces the ~8 direct-PostgREST
// (anon) calls the agent used to make. The device is resolved from its bearer
// token (never a body device_id), and every read/write below is scoped to THAT
// device via the service-role client — so an agent can only ever touch its own
// rows. Structure: apply the "up" batch first, then build the "down" payload
// (so results written up are reflected in the pending-command queue we return).

type UpBody = {
  heartbeat?: { agent_version?: string; ip_address?: string; device_user?: string }
  pairing_code?: string | null
  events?: Array<{ level: string; event: string; message?: string }>
  logs?: Array<{ app_name: string; action: string }>
  inventory?: { scan_time: string; rows: Array<Record<string, unknown>> }
  command_results?: Array<{ id: string; status: string; result?: string }>
}

const APP_CMD_FIELDS =
  'id,name,process_name,mac_app_path,windows_uninstall,linux_package,allow_elevation,' +
  'mac_install_url,mac_install_sha256,windows_install_url,windows_install_sha256,windows_install_args'

export async function POST(req: NextRequest) {
  const admin = createAdminClient()
  const device = await authenticateDevice(req, admin)
  if (!device) {
    return NextResponse.json({ error: 'invalid or missing device token' }, { status: 401 })
  }

  const deviceId = device.device_id
  let body: UpBody = {}
  try { body = (await req.json()) as UpBody } catch { /* empty body is fine */ }

  // ── UP: apply what the agent reported (best-effort; one bad write must not
  //     abort the sync, mirroring the agent's own best-effort logging). ──────────

  // Heartbeat + pairing-code publish + read-and-clear of pending_command, folded
  // into a single devices UPDATE scoped to this device.
  const patch: Record<string, string | null> = { last_seen: new Date().toISOString() }
  if (body.heartbeat?.agent_version) patch.agent_version = body.heartbeat.agent_version
  if (body.heartbeat?.ip_address)    patch.ip_address    = body.heartbeat.ip_address
  if (body.heartbeat?.device_user)   patch.device_user   = body.heartbeat.device_user
  // Publish the pairing code only while unclaimed (claiming clears it).
  if (body.pairing_code && !device.user_id) patch.pairing_code = body.pairing_code
  // Deliver pending_command exactly once: return it below, clear it here.
  const pendingCommand = device.pending_command ?? null
  if (pendingCommand) patch.pending_command = null

  if (body.events?.length) {
    await admin.from('agent_events').insert(
      body.events.slice(0, 100).map(e => ({
        device_id: deviceId,
        level: e.level,
        event: e.event,
        message: (e.message || '').slice(0, 500),
      })),
    )
  }

  if (body.logs?.length) {
    await admin.from('agent_logs').insert(
      body.logs.slice(0, 200).map(l => ({
        device_id: deviceId,
        app_name: l.app_name,
        action: l.action,
      })),
    )
  }

  if (body.inventory?.rows?.length && body.inventory.scan_time) {
    const scanTime = body.inventory.scan_time
    const rows = body.inventory.rows.slice(0, 5000).map(r => ({ ...r, device_id: deviceId, last_seen: scanTime }))
    const { error: upErr } = await admin
      .from('device_software')
      .upsert(rows, { onConflict: 'device_id,name,version' })
    if (!upErr) {
      // Anything this scan didn't touch was uninstalled — prune it.
      await admin.from('device_software').delete().eq('device_id', deviceId).lt('last_seen', scanTime)
    }
    patch.last_inventory_at = scanTime
  }

  if (body.command_results?.length) {
    for (const r of body.command_results.slice(0, 50)) {
      // Scope to this device so a token can't write results for another device's command.
      await admin
        .from('device_commands')
        .update({ status: r.status, result: (r.result || '').slice(0, 500), updated_at: new Date().toISOString() })
        .eq('id', r.id)
        .eq('device_id', deviceId)
    }
  }

  await admin.from('devices').update(patch).eq('device_id', deviceId)

  // ── DOWN: everything the agent's local enforcement logic consumes. Scoped to
  //     this device; resolver RPCs get the token-derived device_id. ─────────────

  const [apps, policies, mode, usb, hashes, grantedIds, commands] = await Promise.all([
    getApps(admin),
    getPolicies(admin, device),
    getEnforcementMode(admin, deviceId),
    getRemovableStorage(admin, deviceId),
    getBlockedHashes(admin, deviceId),
    getGrantedAppIds(admin, device.user_id),
    getPendingCommands(admin, deviceId),
  ])

  return NextResponse.json({
    context: {
      user_id: device.user_id,
      org_id: device.org_id,
      location_id: device.location_id,
      ring_id: device.ring_id,
    },
    pending_command: pendingCommand,
    apps,
    policies,
    enforcement_mode: mode,
    removable_storage: usb,
    blocked_hashes: hashes,
    granted_app_ids: grantedIds,
    commands,
  })
}

type Admin = ReturnType<typeof createAdminClient>

async function getApps(admin: Admin) {
  const { data } = await admin
    .from('apps')
    .select('id,name,process_name,status')
    .not('process_name', 'is', null)
  return data ?? []
}

async function getPolicies(admin: Admin, device: { org_id: string | null; location_id: string | null; ring_id: string | null; device_id: string }) {
  // Same scope set the agent resolved before: org, location, ring, and the device
  // itself (device-scoped app_policies use device_id as scope_id).
  const ids = [device.org_id, device.location_id, device.ring_id, device.device_id].filter(Boolean) as string[]
  if (!ids.length) return []
  const { data } = await admin
    .from('app_policies')
    .select('app_id,scope_id,status')
    .in('scope_id', ids)
  return data ?? []
}

async function getEnforcementMode(admin: Admin, deviceId: string): Promise<string> {
  const { data, error } = await admin.rpc('effective_enforcement_mode', { p_device_id: deviceId })
  // Fail safe: never silently disable enforcement on a lookup error.
  return !error && (data === 'enforce' || data === 'learn') ? data : 'enforce'
}

async function getRemovableStorage(admin: Admin, deviceId: string): Promise<string> {
  const { data, error } = await admin.rpc('effective_removable_storage', { p_device_id: deviceId })
  return !error && (data === 'allow' || data === 'block') ? data : 'allow'
}

async function getBlockedHashes(admin: Admin, deviceId: string): Promise<string[]> {
  const { data, error } = await admin.rpc('blocked_hashes_for_device', { p_device_id: deviceId })
  if (error || !Array.isArray(data)) return []
  return data.filter((h): h is string => typeof h === 'string' && !!h).map(h => h.toLowerCase())
}

async function getGrantedAppIds(admin: Admin, userId: string | null): Promise<string[]> {
  if (!userId) return []
  const { data } = await admin
    .from('app_requests')
    .select('app_id,expires_at')
    .eq('user_id', userId)
    .eq('status', 'approved')
  if (!data) return []
  const now = Date.now()
  const granted: string[] = []
  for (const row of data) {
    if (!row.expires_at) { granted.push(row.app_id); continue }
    const t = Date.parse(row.expires_at)
    if (!Number.isNaN(t) && t > now) granted.push(row.app_id) // unparseable expiry → fail safe (no grant)
  }
  return granted
}

async function getPendingCommands(admin: Admin, deviceId: string) {
  const { data: cmds } = await admin
    .from('device_commands')
    .select('id,type,app_id')
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (!cmds?.length) return []

  // Join each command's app metadata (the agent used a separate get_app_detail).
  const appIds = [...new Set(cmds.map(c => c.app_id).filter(Boolean))] as string[]
  const appsById = new Map<string, Record<string, unknown>>()
  if (appIds.length) {
    const { data: apps } = await admin.from('apps').select(APP_CMD_FIELDS).in('id', appIds)
    for (const a of (apps ?? []) as unknown as Array<Record<string, unknown>>) {
      appsById.set(a.id as string, a)
    }
  }

  // Mark delivered commands 'running' so they aren't re-delivered next cycle and
  // the portal reflects in-progress state (results arrive on a later sync).
  const ids = cmds.map(c => c.id)
  await admin.from('device_commands').update({ status: 'running', updated_at: new Date().toISOString() }).in('id', ids)

  return cmds.map(c => ({ id: c.id, type: c.type, app: c.app_id ? appsById.get(c.app_id) ?? null : null }))
}
