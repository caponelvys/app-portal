import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import { getCallerProfile, getAccessibleOrgIds, isMspStaff } from '@/lib/rbac'
import { resolveRuleMatches, type PolicyRule } from '@/lib/policyRules'
import RulesManager from './RulesManager'

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

export default async function PolicyRulesPage() {
  const supabase = await createClient()
  const profile = await getCallerProfile(supabase)
  if (!profile) redirect('/login')
  if (!isMspStaff(profile)) redirect('/')

  const orgIds = await getAccessibleOrgIds(supabase, profile)
  const scopeIds = orgIds !== null ? (orgIds.length ? orgIds : [NO_MATCH]) : null

  let orgQ = supabase.from('orgs').select('id, name').order('name').limit(1000)
  if (scopeIds) orgQ = orgQ.in('id', scopeIds)
  let locQ = supabase.from('locations').select('id, name, org_id').order('name').limit(2000)
  if (scopeIds) locQ = locQ.in('org_id', scopeIds)

  const admin = createAdminClient()
  let devQ = admin.from('devices').select('device_id, hostname, org_id').order('hostname').limit(5000)
  if (scopeIds) devQ = devQ.in('org_id', scopeIds)
  let rulesQ = admin.from('policy_rules').select('*').order('created_at', { ascending: false })
  if (scopeIds) rulesQ = rulesQ.in('org_id', scopeIds)

  const [{ data: orgs }, { data: locations }, { data: devices }, { data: rules }] = await Promise.all([orgQ, locQ, devQ, rulesQ])

  // Name maps for the scope label on each rule.
  const orgName = new Map((orgs ?? []).map(o => [o.id, o.name]))
  const locName = new Map((locations ?? []).map(l => [l.id, l.name]))
  const devName = new Map((devices ?? []).map(d => [d.device_id, d.hostname]))
  const scopeLabel = (t: string, id: string) =>
    t === 'org' ? (orgName.get(id) ?? 'Unknown org')
      : t === 'location' ? `${locName.get(id) ?? 'Unknown location'} (location)`
        : `${devName.get(id) ?? 'Unknown device'} (device)`

  const rulesWithCounts = await Promise.all((rules ?? []).map(async r => ({
    id: r.id as string,
    match_type: r.match_type as string,
    match_value: r.match_value as string,
    action: r.action as string,
    scope_label: scopeLabel(r.scope_type as string, r.scope_id as string),
    matched: (await resolveRuleMatches(admin, r as PolicyRule)).length,
  })))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Policy rules</h1>
      <p className="text-gray-500 text-sm mb-6">
        Allow or block software in bulk by publisher, path, or name. Rules resolve against reported inventory and stay
        current as new apps appear — so an app update never slips past a rule.
      </p>
      <RulesManager
        orgs={(orgs ?? []).map(o => ({ id: o.id, name: o.name }))}
        locations={(locations ?? []).map(l => ({ id: l.id, name: l.name, org_id: l.org_id }))}
        devices={(devices ?? []).map(d => ({ id: d.device_id, name: d.hostname, org_id: d.org_id }))}
        rules={rulesWithCounts}
      />
    </div>
  )
}
