import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { durationLabel } from '@/lib/durations'
import { cleanHostname } from '@/lib/hostname'

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

  const [{ data: requests }, { data: logs }, { data: apps }] = await Promise.all([
    admin.from('app_requests').select('app_id, user_id, duration, status, created_at, reviewed_at, reviewed_by').order('created_at', { ascending: false }).limit(5000),
    admin.from('agent_logs').select('device_id, app_name, action, created_at').order('created_at', { ascending: false }).limit(5000),
    admin.from('apps').select('id, name'),
  ])

  // Resolve only referenced devices/users so the export doesn't silently drop
  // rows to the 1000-row cap.
  const deviceIds = [...new Set((logs ?? []).map(l => l.device_id).filter(Boolean))]
  // Resolve device names from the live table first, then the archive (so events
  // for deleted devices keep their name in the export).
  const [{ data: devices }, { data: archived }] = deviceIds.length
    ? await Promise.all([
        admin.from('devices').select('device_id, hostname').in('device_id', deviceIds),
        admin.from('device_archive').select('device_id, hostname').in('device_id', deviceIds),
      ])
    : [{ data: [] }, { data: [] }]
  const userIds = [...new Set(
    (requests ?? []).flatMap(r => [r.user_id, r.reviewed_by].filter(Boolean)),
  )] as string[]
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('id, email').in('id', userIds)
    : { data: [] }

  const appName = new Map((apps ?? []).map(a => [a.id, a.name]))
  const email   = new Map((profiles ?? []).map(p => [p.id, p.email]))
  const hostname = new Map<string, string | null>()
  for (const d of archived ?? []) hostname.set(d.device_id, d.hostname)
  for (const d of devices ?? []) hostname.set(d.device_id, d.hostname)  // live wins

  type Event = { time: string; kind: string; app: string; actor: string; detail: string }
  const events: Event[] = []

  for (const r of requests ?? []) {
    const who = email.get(r.user_id) ?? 'Unknown user'
    const app = appName.get(r.app_id) ?? 'Unknown app'
    // Device column is device-only; requests/reviews are user actions → blank there.
    events.push({ time: r.created_at, kind: 'Requested', app, actor: '', detail: `requested ${durationLabel(r.duration).toLowerCase()} access` })
    if (r.reviewed_at && ['approved', 'denied', 'revoked'].includes(r.status)) {
      events.push({ time: r.reviewed_at, kind: r.status.charAt(0).toUpperCase() + r.status.slice(1), app, actor: '', detail: `${r.status} access for ${who}` })
    }
  }

  for (const l of logs ?? []) {
    const cleanName = cleanHostname(hostname.get(l.device_id) ?? undefined)
    events.push({
      time: l.created_at,
      kind: l.action === 'accessed' ? 'Accessed' : 'Blocked',
      app: l.app_name,
      actor: cleanName || 'Unknown device',
      detail: l.action === 'accessed' ? `used on ${cleanName || 'a device'}` : `blocked on ${cleanName || 'a device'}`,
    })
  }

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const lines = [
    row('Timestamp', 'Event', 'App', 'Device', 'Detail'),
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
