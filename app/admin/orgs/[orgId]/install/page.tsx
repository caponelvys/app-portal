import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect, notFound } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import Breadcrumbs from '@/app/admin/Breadcrumbs'
import EnrollmentPanel from '@/app/admin/locations/[locId]/EnrollmentPanel'

export default async function OrgInstallPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const supabase = await createClient()

  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  if (orgIds !== null && !orgIds.includes(orgId)) redirect('/admin/orgs')

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single()
  if (!org) notFound()

  // Use admin client to read enrollment_token (anon key can't see it)
  const admin = createAdminClient()
  const { data: locations } = await admin
    .from('locations')
    .select('id, name, enrollment_token')
    .eq('org_id', orgId)
    .order('name')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Organizations', href: '/admin/orgs' },
        { label: org.name, href: `/admin/orgs/${org.id}` },
        { label: 'Install Agent' },
      ]} />
      <h1 className="text-2xl font-bold text-white mb-1">Install Agent</h1>
      <p className="text-sm text-gray-500 mb-6">
        Run the install command on any device to enroll it into {org.name}. Each location has its own token — devices will inherit that location's policies automatically.
      </p>

      {locations && locations.length > 0 ? (
        <div className="space-y-6">
          {locations.map(loc => (
            <div key={loc.id}>
              <h2 className="text-sm font-semibold text-gray-300 mb-2">{loc.name}</h2>
              <EnrollmentPanel locationId={loc.id} initialToken={loc.enrollment_token} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-gray-500 text-sm">
          No locations yet. <a href={`/admin/orgs/${org.id}`} className="text-blue-400 hover:text-blue-300">Add a location</a> first — each location gets its own enrollment token.
        </div>
      )}
    </div>
  )
}
