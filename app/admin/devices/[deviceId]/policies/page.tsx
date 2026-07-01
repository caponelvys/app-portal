import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { toStatusMap, type PolicyApp, type PolicyStatus } from '@/lib/policy'
import PolicyEditor from '../../../PolicyEditor'
import Breadcrumbs from '@/app/admin/Breadcrumbs'
import { cleanHostname } from '@/lib/hostname'

export default async function DevicePoliciesPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: device } = await supabase
    .from('devices')
    .select('device_id, hostname, org_id, location_id')
    .eq('device_id', deviceId)
    .single()
  if (!device) notFound()

  const [{ data: apps }, { data: orgPolicies }, { data: locPolicies }, { data: devPolicies }, { data: org }, { data: location }] =
    await Promise.all([
      supabase.from('apps').select('id, name, icon_url, status').order('name'),
      device.org_id ? supabase.from('app_policies').select('app_id, status').eq('scope_type', 'org').eq('scope_id', device.org_id) : Promise.resolve({ data: [] }),
      device.location_id ? supabase.from('app_policies').select('app_id, status').eq('scope_type', 'location').eq('scope_id', device.location_id) : Promise.resolve({ data: [] }),
      supabase.from('app_policies').select('app_id, status').eq('scope_type', 'device').eq('scope_id', deviceId),
      device.org_id ? supabase.from('orgs').select('id, name').eq('id', device.org_id).single() : Promise.resolve({ data: null }),
      device.location_id ? supabase.from('locations').select('id, name').eq('id', device.location_id).single() : Promise.resolve({ data: null }),
    ])
  const orgMap = toStatusMap(orgPolicies)
  const locMap = toStatusMap(locPolicies)
  const devMap = toStatusMap(devPolicies)

  const policyApps: PolicyApp[] = (apps ?? []).map(a => ({
    id: a.id,
    name: a.name,
    icon_url: a.icon_url,
    inherited: locMap.get(a.id) ?? orgMap.get(a.id) ?? (a.status as PolicyStatus) ?? 'allowed',
    override: devMap.get(a.id) ?? null,
  }))

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Organizations', href: '/admin/orgs' },
        ...(org ? [{ label: org.name, href: `/admin/orgs/${org.id}` }] : []),
        ...(location ? [{ label: location.name, href: `/admin/locations/${location.id}` }] : []),
        { label: cleanHostname(device.hostname) || 'Device', href: `/admin/devices/${device.device_id}` },
        { label: 'Policies' },
      ]} />
      <h2 className="text-2xl font-semibold text-white mb-1">Device policies</h2>
      <p className="text-sm text-gray-500 mb-4">
        Overrides for {cleanHostname(device.hostname) || 'this device'} only. &ldquo;Inherit&rdquo; uses the location/org defaults.
      </p>
      <PolicyEditor scopeType="device" scopeId={device.device_id} apps={policyApps} />
    </div>
  )
}
