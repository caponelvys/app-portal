import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

// Per-device bearer-token auth for the agent. Enrollment mints a secret; only its
// sha256 is stored (devices.token_hash). Every agent request carries the secret in
// `Authorization: Bearer dvt_…`; the server looks the device up BY token_hash and
// uses that row's identity — a device_id in the request body is never trusted, so
// an agent can only ever touch its own rows. This is the choke point for the whole
// agent surface, mirroring lib/rbac.ts for the human/portal surface.

export type AuthedDevice = {
  id: string
  device_id: string
  org_id: string | null
  location_id: string | null
  ring_id: string | null
  user_id: string | null
  pending_command: string | null
}

const TOKEN_PREFIX = 'dvt_'

export function mintDeviceToken(): { token: string; hash: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url')
  return { token, hash: hashDeviceToken(token) }
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const t = auth.slice(7).trim()
    if (t.startsWith(TOKEN_PREFIX)) return t
  }
  const x = req.headers.get('x-device-token')
  if (x && x.startsWith(TOKEN_PREFIX)) return x.trim()
  return null
}

// Resolve the device from its bearer token. Returns null (→ caller replies 401)
// when the header is missing/malformed or the token doesn't match a device.
export async function authenticateDevice(
  req: NextRequest,
  admin: SupabaseClient = createAdminClient(),
): Promise<AuthedDevice | null> {
  const token = bearerToken(req)
  if (!token) return null
  const { data, error } = await admin
    .from('devices')
    .select('id, device_id, org_id, location_id, ring_id, user_id, pending_command, token_hash')
    .eq('token_hash', hashDeviceToken(token))
    .maybeSingle()
  if (error || !data || !data.token_hash) return null
  // token_hash matched via an indexed equality; re-compare in constant time as a
  // belt-and-suspenders guard against any partial-match surprises.
  const a = Buffer.from(data.token_hash)
  const b = Buffer.from(hashDeviceToken(token))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const { token_hash: _omit, ...device } = data
  return device as AuthedDevice
}
