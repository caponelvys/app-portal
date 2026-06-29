import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { expireGrants } from '@/lib/expireGrants'

// Scheduled cleanup of expired grants. Configured as a Vercel Cron in
// vercel.json. Vercel sends `Authorization: Bearer ${CRON_SECRET}`; if
// CRON_SECRET is set we require it, otherwise the endpoint is open (it only
// marks already-expired grants, so it is harmless either way).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const expired = await expireGrants(createAdminClient())
  return NextResponse.json({ expired })
}
