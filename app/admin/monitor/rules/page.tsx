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

  const admin = createAdminClient()
  let rulesQ = admin.from('policy_rules').select('*').order('created_at', { ascending: false })
  if (scopeIds) rulesQ = rulesQ.in('org_id', scopeIds)

  const [{ data: orgs }, { data: rules }] = await Promise.all([orgQ, rulesQ])

  const orgName = new Map((orgs ?? []).map(o => [o.id, o.name]))
  const rulesWithCounts = await Promise.all((rules ?? []).map(async r => ({
    id: r.id as string,
    match_type: r.match_type as string,
    match_value: r.match_value as string,
    action: r.action as string,
    org_id: r.org_id as string,
    org_name: orgName.get(r.org_id) ?? 'Unknown org',
    matched: (await resolveRuleMatches(admin, r as PolicyRule)).length,
  })))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Policy rules</h1>
      <p className="text-gray-500 text-sm mb-6">
        Allow or block software in bulk by publisher, path, or name. Rules resolve against reported inventory and stay
        current as new apps appear — so an app update never slips past a rule.
      </p>
      <RulesManager orgs={(orgs ?? []).map(o => ({ id: o.id, name: o.name }))} rules={rulesWithCounts} />
    </div>
  )
}
