import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { durationLabel } from '@/lib/durations'

const KIND_LABELS: Record<string, string> = {
  request: 'Requested',
  approved: 'Approved',
  denied: 'Denied',
  revoked: 'Revoked',
  accessed: 'Accessed',
  killed: 'Blocked',
}

const KIND_COLORS: Record<string, string> = {
  request:  '#b45309',
  approved: '#15803d',
  denied:   '#b91c1c',
  revoked:  '#b91c1c',
  accessed: '#1d4ed8',
  killed:   '#4b5563',
}

export default async function AuditPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ org_id?: string; org_name?: string }>
}) {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const { org_id, org_name } = await searchParams
  const isClientReport = !!org_id
  const admin = createAdminClient()

  // Fetch base data
  const [{ data: apps }, { data: allProfiles }, { data: allDevices }] = await Promise.all([
    admin.from('apps').select('id, name'),
    admin.from('profiles').select('id, email, org_id'),
    admin.from('devices').select('device_id, hostname, user_id, org_id'),
  ])

  const appName  = new Map((apps ?? []).map(a => [a.id, a.name]))

  // Filter by org if requested
  const profiles = isClientReport
    ? (allProfiles ?? []).filter(p => p.org_id === org_id)
    : (allProfiles ?? [])
  const devices = isClientReport
    ? (allDevices ?? []).filter(d => d.org_id === org_id)
    : (allDevices ?? [])

  const profileIds = new Set(profiles.map(p => p.id))
  const deviceIds  = new Set(devices.map(d => d.device_id))
  const email      = new Map(profiles.map(p => [p.id, p.email]))
  const device     = new Map(devices.map(d => [d.device_id, d]))

  // Fetch requests + logs filtered by org scope
  let reqQ = admin.from('app_requests').select('app_id, user_id, duration, status, created_at, reviewed_at, reviewed_by')
  let logQ = admin.from('agent_logs').select('device_id, app_name, action, created_at').order('created_at', { ascending: false }).limit(5000)

  const [{ data: requests }, { data: logs }] = await Promise.all([reqQ, logQ])

  type Event = { time: string; kind: string; app: string; actor: string; detail: string }
  const events: Event[] = []

  for (const r of requests ?? []) {
    if (isClientReport && !profileIds.has(r.user_id)) continue
    const who = email.get(r.user_id) ?? 'Unknown user'
    const app = appName.get(r.app_id) ?? 'Unknown app'
    events.push({ time: r.created_at, kind: 'request', app, actor: who, detail: `requested ${durationLabel(r.duration).toLowerCase()} access` })
    if (r.reviewed_at && ['approved', 'denied', 'revoked'].includes(r.status)) {
      const reviewer = (r.reviewed_by && email.get(r.reviewed_by)) || 'admin'
      events.push({ time: r.reviewed_at, kind: r.status, app, actor: reviewer, detail: `${r.status} access for ${who}` })
    }
  }

  for (const l of logs ?? []) {
    if (isClientReport && !deviceIds.has(l.device_id)) continue
    const dev = device.get(l.device_id)
    const who = (dev?.user_id && email.get(dev.user_id)) || (dev?.hostname ? dev.hostname.split('.')[0] : null) || 'Unknown device'
    events.push({
      time: l.created_at,
      kind: l.action === 'accessed' ? 'accessed' : 'killed',
      app: l.app_name,
      actor: who,
      detail: l.action === 'accessed' ? `used on ${dev?.hostname ?? 'a device'}` : `blocked on ${dev?.hostname ?? 'a device'}`,
    })
  }

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const title = isClientReport ? `${org_name ?? 'Client'} — App Activity Report` : 'App Activity Report — All Clients'

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #111; background: #fff; padding: 40px; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none !important; }
          }
          .header { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
          .header p { font-size: 12px; color: #555; }
          .meta { display: flex; gap: 32px; margin-bottom: 24px; }
          .meta-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; display: block; margin-bottom: 2px; }
          .meta-item value { font-size: 13px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          thead tr { background: #f3f4f6; }
          th { text-align: left; padding: 8px 10px; font-weight: 600; color: #374151; border-bottom: 1px solid #d1d5db; white-space: nowrap; }
          td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          tr:last-child td { border-bottom: none; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
          .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
          .print-btn { position: fixed; bottom: 24px; right: 24px; background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          .empty { text-align: center; padding: 48px; color: #9ca3af; }
        `}</style>
      </head>
      <body>
        <div className="header">
          <h1>{title}</h1>
          <p>Prepared on {reportDate}</p>
        </div>

        <div className="meta">
          <div className="meta-item">
            <label>Total Events</label>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{events.length}</span>
          </div>
          {isClientReport && (
            <div className="meta-item">
              <label>Organization</label>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{org_name ?? '—'}</span>
            </div>
          )}
          <div className="meta-item">
            <label>Devices</label>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{devices.length}</span>
          </div>
          <div className="meta-item">
            <label>Users</label>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{profiles.length}</span>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="empty">No activity recorded for this period.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>App</th>
                <th>Who</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i}>
                  <td style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(e.time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{ background: (KIND_COLORS[e.kind] ?? '#4b5563') + '22', color: KIND_COLORS[e.kind] ?? '#4b5563' }}
                    >
                      {KIND_LABELS[e.kind] ?? e.kind}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{e.app}</td>
                  <td style={{ color: '#374151' }}>{e.actor}</td>
                  <td style={{ color: '#6b7280' }}>{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="footer">
          <span>App Controller — Confidential</span>
          <span>Generated {reportDate}</span>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('DOMContentLoaded', function() {
            document.querySelector('.print-btn').addEventListener('click', function() { window.print(); });
            setTimeout(function() { window.print(); }, 400);
          });
        `}} />
        <button className="print-btn no-print">Print / Save as PDF</button>
      </body>
    </html>
  )
}
