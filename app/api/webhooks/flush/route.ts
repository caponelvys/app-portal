import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getCallerProfile, isMspStaff } from '@/lib/rbac'
import { forwardAll } from '@/lib/webhooks'

// The scheduled forwarder. Authorized ONLY by the Vercel Cron secret
// (Authorization: Bearer $CRON_SECRET) or an msp-staff session (manual flush).
// Fails CLOSED: with no CRON_SECRET set, unauthenticated cron calls are rejected
// (set CRON_SECRET in the Vercel env for the scheduled job to run).
async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  const profile = await getCallerProfile(await createServerClient())
  return !!profile && isMspStaff(profile)
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await forwardAll(createAdminClient())
  return NextResponse.json({ success: true, ...result })
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
