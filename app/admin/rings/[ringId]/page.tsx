import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect, notFound } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { toStatusMap, type PolicyApp, type PolicyStatus } from '@/lib/policy'
import PolicyEditor from '@/app/admin/PolicyEditor'
import Breadcrumbs from '@/app/admin/Breadcrumbs'
import PromoteRing from './PromoteRing'

export default async function RingPoliciesPage({ params }: { params: Promise<{ ringId: string }> }) {
  const { ringId } = await params
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const admin = createAdminClient()
  const { data: ring } = await admin.from('rings').select('id, name, org_id, position').eq('id', ringId).maybeSingle()
  if (!ring) notFound()

  // Access + org name.
  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && !orgIds.includes(ring.org_id)) redirect('/')

  const [{ data: org }, { data: apps }, { data: ringPolicies }, { data: nextRing }] = await Promise.all([
    admin.from('orgs').select('id, name').eq('id', ring.org_id).maybeSingle(),
    supabase.from('apps').select('id, name, icon_url, status').order('name'),
    admin.from('app_policies').select('app_id, status').eq('scope_type', 'ring').eq('scope_id', ringId),
    admin.from('rings').select('id, name').eq('org_id', ring.org_id).gt('position', ring.position).order('position').limit(1).maybeSingle(),
  ])

  const ringMap = toStatusMap(ringPolicies)
  const policyApps: PolicyApp[] = (apps ?? []).map(a => ({
    id: a.id,
    name: a.name,
    icon_url: a.icon_url,
    inherited: (a.status as PolicyStatus) ?? 'allowed',
    override: ringMap.get(a.id) ?? null,
  }))

  const overrideCount = (ringPolicies ?? []).length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Organizations', href: '/admin/orgs' },
        ...(org ? [{ label: org.name, href: `/admin/orgs/${org.id}` }] : []),
        { label: `${ring.name} ring` },
      ]} />
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h2 className="text-2xl font-semibold text-white">{ring.name} ring policies</h2>
        {nextRing && (
          <PromoteRing ringId={ring.id} ringName={ring.name} nextName={nextRing.name} overrideCount={overrideCount} />
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Applies to devices in the {ring.name} ring, overriding their location and org defaults. Stage a change here, validate,
        then {nextRing ? <>promote it to <span className="text-gray-300">{nextRing.name}</span>.</> : <>it&apos;s the final ring.</>}
      </p>
      <PolicyEditor scopeType="ring" scopeId={ring.id} apps={policyApps} />
    </div>
  )
}
