import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { cleanHostname } from '@/lib/hostname'
import TemplatesManager from './TemplatesManager'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

export default async function PolicyTemplatesPage() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const scopeIds = orgIds !== null ? (orgIds.length ? orgIds : [NO_MATCH]) : null

  const admin = createAdminClient()

  let orgQ = supabase.from('orgs').select('id, name').order('name').limit(1000)
  if (scopeIds) orgQ = orgQ.in('id', scopeIds)
  let locQ = supabase.from('locations').select('id, name, org_id').order('name').limit(2000)
  if (scopeIds) locQ = locQ.in('org_id', scopeIds)
  let devQ = admin.from('devices').select('device_id, hostname, org_id').order('hostname').limit(5000)
  if (scopeIds) devQ = devQ.in('org_id', scopeIds)
  let ringQ = admin.from('rings').select('id, name, org_id').order('position').limit(2000)
  if (scopeIds) ringQ = ringQ.in('org_id', scopeIds)

  const [{ data: templates }, { data: orgs }, { data: locations }, { data: devices }, { data: rings }] = await Promise.all([
    admin.from('policy_templates').select('id, name, description, created_at').order('created_at', { ascending: false }),
    orgQ, locQ, devQ, ringQ,
  ])

  const tmplIds = (templates ?? []).map(t => t.id)
  const { data: items } = tmplIds.length
    ? await admin.from('policy_template_items').select('template_id, app_id, status, apps(name)').in('template_id', tmplIds)
    : { data: [] }

  const itemsByTemplate = new Map<string, { app: string; status: string }[]>()
  for (const it of (items ?? []) as { template_id: string; status: string; apps: { name: string }[] | { name: string } | null }[]) {
    const rel = Array.isArray(it.apps) ? it.apps[0] : it.apps
    const arr = itemsByTemplate.get(it.template_id) ?? []
    arr.push({ app: rel?.name ?? 'Unknown app', status: it.status })
    itemsByTemplate.set(it.template_id, arr)
  }

  const templateList = (templates ?? []).map(t => ({
    id: t.id, name: t.name, description: t.description as string | null,
    items: (itemsByTemplate.get(t.id) ?? []).sort((a, b) => a.app.localeCompare(b.app)),
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Policy templates</h1>
      <p className="text-gray-500 text-sm mb-6">
        Reusable sets of allow/block rules. Capture a scope&apos;s current policy as a template, then apply it to any org,
        location, device, or ring in one step.
      </p>
      <TemplatesManager
        templates={templateList}
        orgs={(orgs ?? []).map(o => ({ id: o.id, name: o.name, org_id: o.id }))}
        locations={(locations ?? []).map(l => ({ id: l.id, name: l.name, org_id: l.org_id }))}
        devices={(devices ?? []).map(d => ({ id: d.device_id, name: cleanHostname(d.hostname), org_id: d.org_id }))}
        rings={(rings ?? []).map(r => ({ id: r.id, name: r.name, org_id: r.org_id }))}
      />
    </div>
  )
}
