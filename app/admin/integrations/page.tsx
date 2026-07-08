import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import WebhooksManager from './WebhooksManager'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const scopeIds = orgIds !== null ? (orgIds.length ? orgIds : [NO_MATCH]) : null

  let orgQ = supabase.from('orgs').select('id, name').order('name').limit(1000)
  if (scopeIds) orgQ = orgQ.in('id', scopeIds)

  const admin = createAdminClient()
  let epQ = admin.from('webhook_endpoints')
    .select('id, org_id, url, enabled, last_status, last_delivered_at').order('created_at', { ascending: false })
  if (scopeIds) epQ = epQ.in('org_id', scopeIds)

  const [{ data: orgs }, { data: endpoints }] = await Promise.all([orgQ, epQ])
  const orgName = new Map((orgs ?? []).map(o => [o.id, o.name]))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Integrations</h1>
      <p className="text-gray-500 text-sm mb-6">
        Stream audit events to an external endpoint (SIEM, PSA, or automation) via signed webhooks. Each delivery is signed
        with HMAC-SHA256 in the <span className="font-mono text-gray-400">X-Ravyn-Signature</span> header.
      </p>
      <WebhooksManager
        isGlobalAllowed={orgIds === null}
        orgs={(orgs ?? []).map(o => ({ id: o.id, name: o.name }))}
        endpoints={(endpoints ?? []).map(e => ({
          id: e.id, url: e.url, enabled: e.enabled,
          scope: e.org_id ? (orgName.get(e.org_id) ?? 'Unknown org') : 'All organizations',
          last_status: e.last_status as string | null,
          last_delivered_at: e.last_delivered_at as string | null,
        }))}
      />
    </div>
  )
}
