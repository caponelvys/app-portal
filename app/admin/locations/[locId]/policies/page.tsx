import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { toStatusMap, type PolicyApp, type PolicyStatus } from '@/lib/policy'
import PolicyEditor from '../../../PolicyEditor'
import Breadcrumbs from '@/app/admin/Breadcrumbs'

export default async function LocationPoliciesPage({ params }: { params: Promise<{ locId: string }> }) {
  const { locId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: location } = await supabase.from('locations').select('id, name, org_id').eq('id', locId).single()
  if (!location) notFound()
  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', location.org_id).single()

  const [{ data: apps }, { data: orgPolicies }, { data: locPolicies }] = await Promise.all([
    supabase.from('apps').select('id, name, icon_url, status').order('name'),
    supabase.from('app_policies').select('app_id, status').eq('scope_type', 'org').eq('scope_id', location.org_id),
    supabase.from('app_policies').select('app_id, status').eq('scope_type', 'location').eq('scope_id', locId),
  ])
  const orgMap = toStatusMap(orgPolicies)
  const locMap = toStatusMap(locPolicies)

  const policyApps: PolicyApp[] = (apps ?? []).map(a => ({
    id: a.id,
    name: a.name,
    icon_url: a.icon_url,
    inherited: orgMap.get(a.id) ?? (a.status as PolicyStatus) ?? 'allowed',
    override: locMap.get(a.id) ?? null,
  }))

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Clients', href: '/admin/orgs' },
        ...(org ? [{ label: org.name, href: `/admin/orgs/${org.id}` }] : []),
        { label: location.name, href: `/admin/locations/${location.id}` },
        { label: 'Policies' },
      ]} />
      <h2 className="text-2xl font-semibold text-white mb-1">Location policies</h2>
      <p className="text-sm text-gray-500 mb-4">
        Overrides for devices at {location.name}. &ldquo;Inherit&rdquo; uses the org default; individual devices can still override these.
      </p>
      <PolicyEditor scopeType="location" scopeId={location.id} apps={policyApps} />
    </div>
  )
}
