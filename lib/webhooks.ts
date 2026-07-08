// Outbound webhook delivery for audit events. Reads new rows from audit_timeline
// per endpoint cursor, POSTs them signed (HMAC-SHA256), and advances the cursor.
// Server-only (uses the service-role client + node crypto).

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const BATCH = 200

export type Endpoint = {
  id: string
  org_id: string | null
  url: string
  secret: string
  enabled: boolean
  cursor: string
}

export type AuditRow = { time: string; kind: string; app: string | null; actor: string | null; detail: string | null; org_id: string | null }

export function sign(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
}

async function post(url: string, secret: string, payload: object): Promise<{ ok: boolean; status: number }> {
  const body = JSON.stringify(payload)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ravyn-Signature': sign(secret, body), 'User-Agent': 'Ravyn-Webhook/1' },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

// Deliver a single sample event immediately (the "send test" action).
export async function sendTest(endpoint: Pick<Endpoint, 'url' | 'secret'>): Promise<{ ok: boolean; status: number }> {
  return post(endpoint.url, endpoint.secret, {
    type: 'test',
    delivered_at: new Date().toISOString(),
    events: [{ time: new Date().toISOString(), kind: 'test', app: null, actor: 'Ravyn', detail: 'Test event from Ravyn' }],
  })
}

// Forward this endpoint's pending events; returns the delivery outcome. On
// success the caller advances the cursor to the last event's time.
export async function forwardEndpoint(admin: SupabaseClient, ep: Endpoint): Promise<{ delivered: number; status: string }> {
  let q = admin.from('audit_timeline').select('time, kind, app, actor, detail, org_id')
    .gt('time', ep.cursor).order('time', { ascending: true }).limit(BATCH)
  if (ep.org_id) q = q.eq('org_id', ep.org_id)
  const { data } = await q
  const events = (data ?? []) as AuditRow[]
  if (events.length === 0) return { delivered: 0, status: 'no new events' }

  const res = await post(ep.url, ep.secret, { type: 'audit', delivered_at: new Date().toISOString(), events })
  const status = res.ok ? `ok ${res.status}` : (res.status ? `http ${res.status}` : 'unreachable')
  if (res.ok) {
    await admin.from('webhook_endpoints').update({
      cursor: events[events.length - 1].time, last_status: status, last_delivered_at: new Date().toISOString(),
    }).eq('id', ep.id)
    return { delivered: events.length, status }
  }
  await admin.from('webhook_endpoints').update({ last_status: status, last_delivered_at: new Date().toISOString() }).eq('id', ep.id)
  return { delivered: 0, status }
}

// Flush all enabled endpoints (the scheduled forwarder).
export async function forwardAll(admin: SupabaseClient): Promise<{ endpoints: number; delivered: number }> {
  const { data: eps } = await admin.from('webhook_endpoints').select('*').eq('enabled', true)
  let delivered = 0
  for (const ep of (eps ?? []) as Endpoint[]) {
    const r = await forwardEndpoint(admin, ep)
    delivered += r.delivered
  }
  return { endpoints: (eps ?? []).length, delivered }
}
