import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { parseTableState, DEFAULT_PAGE_SIZE } from '@/lib/tableParams'
import { cleanPublisher } from '@/lib/software'
import SoftwareTableServer from './SoftwareTableServer'

const PAGE_SIZE = DEFAULT_PAGE_SIZE

type CountRow = {
  name: string
  publisher: string | null
  device_count: number
  version_count: number
  total_count: number
}

export default async function FleetSoftwarePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  // msp_admin → null (all orgs); msp_tech → their orgs. The RPC is service-role
  // and trusts this scoped list (device_software has no authenticated policy).
  const orgIds = await getAccessibleOrgIds(supabase, profile)

  const state = parseTableState(await searchParams)
  const from = (state.page - 1) * PAGE_SIZE

  const { data } = await createAdminClient().rpc('software_install_counts', {
    p_org_ids: orgIds,
    p_search: state.filters.name || null,
    p_limit: PAGE_SIZE,
    p_offset: from,
  })

  const rows = (data ?? []) as CountRow[]
  const total = rows.length ? Number(rows[0].total_count) : 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Software inventory</h1>
      <p className="text-gray-500 text-sm mb-6">
        Installed applications reported across the fleet, most-deployed first. Devices report inventory on agent v1.7.17+.
      </p>
      <SoftwareTableServer
        rows={rows.map(r => ({
          name: r.name, publisher: cleanPublisher(r.publisher),
          device_count: Number(r.device_count), version_count: Number(r.version_count),
        }))}
        total={total}
        state={state}
        pageSize={PAGE_SIZE}
        userId={profile.id}
      />
    </div>
  )
}
