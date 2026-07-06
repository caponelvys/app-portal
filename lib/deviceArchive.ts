import type { createAdminClient } from '@/lib/supabase-admin'
import { cleanHostname } from '@/lib/hostname'

// Resolve device_id → display name for a set of ids, reading the live devices
// table AND the archive, so events for deleted devices still show the device name
// (never the raw UUID). Live rows win; ids with neither resolve to 'Unknown device'.
// Every requested id gets an entry, so callers can index without a UUID fallback.
export async function resolveDeviceNames(
  admin: ReturnType<typeof createAdminClient>,
  deviceIds: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const ids = [...new Set(deviceIds.filter(Boolean))] as string[]
  if (!ids.length) return {}
  const [{ data: devices }, { data: archived }] = await Promise.all([
    admin.from('devices').select('device_id, hostname').in('device_id', ids),
    admin.from('device_archive').select('device_id, hostname').in('device_id', ids),
  ])
  const out: Record<string, string> = {}
  for (const id of ids) out[id] = 'Unknown device'
  for (const d of archived ?? []) out[d.device_id] = cleanHostname(d.hostname) || 'Unknown device'
  for (const d of devices ?? []) out[d.device_id] = cleanHostname(d.hostname) || 'Unknown device'  // live wins
  return out
}

// Snapshot a device's identity into device_archive so historical Reports keep its
// name (and org scoping) after the devices row is deleted. Call this immediately
// BEFORE deleting a device — from self-uninstall and from the manual delete.
// Best-effort and idempotent: an upsert so re-deleting a re-enrolled device is safe.
export async function archiveDevice(admin: ReturnType<typeof createAdminClient>, deviceId: string) {
  const { data: dev } = await admin
    .from('devices')
    .select('device_id, hostname, org_id')
    .eq('device_id', deviceId)
    .maybeSingle()
  if (!dev) return
  await admin
    .from('device_archive')
    .upsert(
      { device_id: dev.device_id, hostname: dev.hostname, org_id: dev.org_id },
      { onConflict: 'device_id' },
    )
}
