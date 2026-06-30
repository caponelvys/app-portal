import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { durationLabel } from '@/lib/durations'

function escapeCell(v: string | null | undefined): string {
  const s = v ?? ''
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function row(...cells: (string | null | undefined)[]) {
  return cells.map(escapeCell).join(',')
}

export async function GET() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isMspStaff(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Use admin client so the full dataset is returned regardless of RLS
  const admin = createAdminClient()

  const [{ data: requests }, { data: logs }, { data: apps }, { data: profiles }, { data: devices }] =
    await Promise.all([
      admin.from('app_requests').select('app_id, user_id, duration, status, created_at, reviewed_at, reviewed_by'),
      admin.from('agent_logs').select('device_id, app_name, action, created_at').order('created_at', { ascending: false }).limit(5000),
      admin.from('apps').select('id, name'),
      admin.from('profiles').select('id, email'),
      admin.from('devices').select('device_id, hostname, user_id'),
    ])

  const appName = new Map((apps ?? []).map(a => [a.id, a.name]))
  const email   = new Map((profiles ?? []).map(p => [p.id, p.email]))
  const device  = new Map((devices ?? []).map(d => [d.device_id, d]))

  type Event = { time: string; kind: string; app: string; actor: string; detail: string }
  const events: Event[] = []

  for (const r of requests ?? []) {
    const who = email.get(r.user_id) ?? 'Unknown user'
    const app = appName.get(r.app_id) ?? 'Unknown app'
    events.push({ time: r.created_at, kind: 'Requested', app, actor: who, detail: `requested ${durationLabel(r.duration).toLowerCase()} access` })
    if (r.reviewed_at && ['approved', 'denied', 'revoked'].includes(r.status)) {
      const reviewer = (r.reviewed_by && email.get(r.reviewed_by)) || 'admin'
      events.push({ time: r.reviewed_at, kind: r.status.charAt(0).toUpperCase() + r.status.slice(1), app, actor: reviewer, detail: `${r.status} access for ${who}` })
    }
  }

  for (const l of logs ?? []) {
    const dev = device.get(l.device_id)
    const who = (dev?.user_id && email.get(dev.user_id)) || dev?.hostname || 'Unknown device'
    events.push({
      time: l.created_at,
      kind: l.action === 'accessed' ? 'Accessed' : 'Blocked',
      app: l.app_name,
      actor: who,
      detail: l.action === 'accessed' ? `used on ${dev?.hostname ?? 'a device'}` : `blocked on ${dev?.hostname ?? 'a device'}`,
    })
  }

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const lines = [
    row('Timestamp', 'Event', 'App', 'Who', 'Detail'),
    ...events.map(e => row(new Date(e.time).toISOString(), e.kind, e.app, e.actor, e.detail)),
  ]

  const csv = lines.join('\r\n')
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
