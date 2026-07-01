import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { cleanHostname } from '@/lib/hostname'

// Human-readable event labels (kept in sync with the device Activity panel).
const EVENT_LABEL: Record<string, string> = {
  started:        'Agent started',
  enrolled:       'Enrolled into location',
  enroll_failed:  'Enrollment failed',
  paired:         'Paired to user',
  pairing:        'Awaiting user pairing',
  update_applied: 'Agent updated',
  update_failed:  'Agent update failed',
  error:          'Agent error',
}

function csvCell(s: string): string {
  return `"${(s ?? '').replace(/"/g, '""')}"`
}

// Download this device's activity log (agent_events + enforcement) as CSV.
// MSP staff only. Reads via the service-role client.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createServerClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return new NextResponse('Forbidden', { status: 403 })

  const admin = createAdminClient()
  const [{ data: dev }, { data: events }, { data: logs }] = await Promise.all([
    admin.from('devices').select('hostname').eq('device_id', deviceId).maybeSingle(),
    admin.from('agent_events').select('level, event, message, created_at').eq('device_id', deviceId).order('created_at', { ascending: false }).limit(2000),
    admin.from('agent_logs').select('app_name, action, created_at').eq('device_id', deviceId).order('created_at', { ascending: false }).limit(2000),
  ])

  type Row = { time: string; level: string; event: string; detail: string }
  const rows: Row[] = [
    ...(events ?? []).map(e => ({
      time: e.created_at,
      level: e.level ?? 'info',
      event: EVENT_LABEL[e.event] ?? e.event,
      detail: e.message ?? '',
    })),
    ...(logs ?? []).map(l => ({
      time: l.created_at,
      level: l.action === 'killed' ? 'warn' : 'info',
      event: l.action === 'accessed' ? 'Accessed app' : 'Blocked app',
      detail: l.app_name ?? '',
    })),
  ].sort((a, b) => b.time.localeCompare(a.time))

  const csv =
    'Time,Level,Event,Detail\n' +
    rows.map(r => [new Date(r.time).toISOString(), r.level, r.event, r.detail].map(csvCell).join(',')).join('\n') +
    '\n'

  const name = (cleanHostname(dev?.hostname) || deviceId).replace(/[^a-zA-Z0-9_-]/g, '_')
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="agent-logs-${name}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
