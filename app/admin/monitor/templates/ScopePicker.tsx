'use client'

import { useState } from 'react'

export type Scoped = { id: string; name: string; org_id: string }
export type ScopeKind = 'org' | 'location' | 'device' | 'ring'

// Org → kind → target cascade. Calls onChange with the resolved (scope_type,
// scope_id) whenever a complete selection is made, or null when incomplete.
export default function ScopePicker({
  orgs, locations, devices, rings, onChange, compact,
}: {
  orgs: Scoped[]; locations: Scoped[]; devices: Scoped[]; rings: Scoped[]
  onChange: (sel: { scope_type: ScopeKind; scope_id: string } | null) => void
  compact?: boolean
}) {
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? '')
  const [kind, setKind] = useState<ScopeKind>('org')
  const [target, setTarget] = useState('')

  const targetsFor = (k: ScopeKind): Scoped[] =>
    k === 'location' ? locations.filter(l => l.org_id === orgId)
      : k === 'device' ? devices.filter(d => d.org_id === orgId)
        : k === 'ring' ? rings.filter(r => r.org_id === orgId) : []

  function emit(nextOrg: string, nextKind: ScopeKind, nextTarget: string) {
    if (nextKind === 'org') onChange(nextOrg ? { scope_type: 'org', scope_id: nextOrg } : null)
    else onChange(nextTarget ? { scope_type: nextKind, scope_id: nextTarget } : null)
  }

  const cls = `rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none ${compact ? '' : 'w-full'}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={orgId} onChange={e => { setOrgId(e.target.value); setTarget(''); emit(e.target.value, kind, '') }} className={cls}>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select value={kind} onChange={e => { const k = e.target.value as ScopeKind; setKind(k); setTarget(''); emit(orgId, k, '') }} className={cls}>
        <option value="org">Whole org</option>
        <option value="location">Location</option>
        <option value="device">Device</option>
        <option value="ring">Ring</option>
      </select>
      {kind !== 'org' && (
        <select value={target} onChange={e => { setTarget(e.target.value); emit(orgId, kind, e.target.value) }} className={cls}>
          <option value="">Select…</option>
          {targetsFor(kind).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
    </div>
  )
}
