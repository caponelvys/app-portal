import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { cleanHostname } from '@/lib/hostname'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile || !isMspStaff(profile)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const pattern = `%${q}%`

  let orgsQ = supabase.from('orgs').select('id, name').ilike('name', pattern).limit(5)
  if (orgIds !== null) orgsQ = orgsQ.in('id', orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000'])

  let locsQ = supabase.from('locations').select('id, name, org_id').ilike('name', pattern).limit(5)
  if (orgIds !== null) locsQ = locsQ.in('org_id', orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000'])

  let devsQ = supabase.from('devices').select('device_id, hostname, org_id, location_id').ilike('hostname', pattern).limit(5)
  if (orgIds !== null) devsQ = devsQ.in('org_id', orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000'])

  const [{ data: orgs }, { data: locations }, { data: devices }] = await Promise.all([orgsQ, locsQ, devsQ])

  const results = [
    ...(orgs ?? []).map(o => ({ type: 'org' as const, id: o.id, label: o.name, url: `/admin/orgs/${o.id}` })),
    ...(locations ?? []).map(l => ({ type: 'location' as const, id: l.id, label: l.name, url: `/admin/locations/${l.id}` })),
    ...(devices ?? []).map(d => ({ type: 'device' as const, id: d.device_id, label: cleanHostname(d.hostname) || d.device_id, url: `/admin/devices/${d.device_id}` })),
  ]

  return NextResponse.json({ results })
}
