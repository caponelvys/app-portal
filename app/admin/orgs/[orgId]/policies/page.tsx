import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { toStatusMap, type PolicyApp, type PolicyStatus } from '@/lib/policy'
import PolicyEditor from '../../../PolicyEditor'

export default async function OrgPoliciesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single()
  if (!org) notFound()

  const [{ data: apps }, { data: orgPolicies }] = await Promise.all([
    supabase.from('apps').select('id, name, icon_url, status').order('name'),
    supabase.from('app_policies').select('app_id, status').eq('scope_type', 'org').eq('scope_id', orgId),
  ])
  const orgMap = toStatusMap(orgPolicies)

  const policyApps: PolicyApp[] = (apps ?? []).map(a => ({
    id: a.id,
    name: a.name,
    icon_url: a.icon_url,
    inherited: (a.status as PolicyStatus) ?? 'allowed', // global default
    override: orgMap.get(a.id) ?? null,
  }))

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <nav className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
          <a href="/admin/orgs" className="hover:text-gray-200">Clients</a>
          <span className="text-gray-600">/</span>
          <a href={`/admin/orgs/${org.id}`} className="hover:text-gray-200">{org.name}</a>
          <span className="text-gray-600">/</span>
          <span className="text-white font-semibold">Policies</span>
        </nav>
        <a href="/auth/signout" className="text-sm text-gray-400 hover:text-gray-200 underline">Sign out</a>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h2 className="text-2xl font-semibold text-white mb-1">Org policies</h2>
        <p className="text-sm text-gray-500 mb-4">
          Defaults for every device in {org.name}. &ldquo;Inherit&rdquo; uses the global default; locations and devices can override these.
        </p>
        <PolicyEditor scopeType="org" scopeId={org.id} apps={policyApps} />
      </main>
    </div>
  )
}
