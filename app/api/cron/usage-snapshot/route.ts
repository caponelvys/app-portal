import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { captureSnapshots, periodOf } from '@/lib/metering'

// Monthly Vercel Cron (vercel.json). On the 1st it snapshots the just-ended
// month's billable counts. Self-authorizes via CRON_SECRET when set (like
// expire-grants); /api/cron is allowlisted in proxy.ts.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const now = new Date()
  // Prior month bounds (UTC).
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const result = await captureSnapshots(createAdminClient(), periodOf(start), start, end)
  return NextResponse.json({ success: true, period: periodOf(start), ...result })
}
