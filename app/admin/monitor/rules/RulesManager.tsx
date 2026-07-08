'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Org = { id: string; name: string }
type Scoped = { id: string; name: string; org_id: string }
type Rule = {
  id: string
  match_type: string
  match_value: string
  action: string
  scope_label: string
  matched: number
}

const MATCH_LABEL: Record<string, string> = { publisher: 'Publisher', path: 'Path', name: 'Name', hash: 'Hash' }
type MatchKind = 'publisher' | 'path' | 'name' | 'hash'
type ScopeKind = 'org' | 'location' | 'device'

export default function RulesManager({ orgs, locations, devices, rules }: {
  orgs: Org[]; locations: Scoped[]; devices: Scoped[]; rules: Rule[]
}) {
  const router = useRouter()
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? '')
  const [scopeKind, setScopeKind] = useState<ScopeKind>('org')
  const [scopeTarget, setScopeTarget] = useState('') // location_id or device_id when narrower than org
  const [matchType, setMatchType] = useState<MatchKind>('publisher')
  const [matchValue, setMatchValue] = useState('')
  const [action, setAction] = useState<'block' | 'allow'>('block')

  // Targets within the chosen org for the narrower scopes.
  const orgLocations = locations.filter(l => l.org_id === orgId)
  const orgDevices = devices.filter(d => d.org_id === orgId)

  // The effective scope for the API: org itself, or the chosen location/device.
  const scope = scopeKind === 'org'
    ? { scope_type: 'org' as const, scope_id: orgId }
    : { scope_type: scopeKind, scope_id: scopeTarget }
  const scopeReady = scopeKind === 'org' ? !!orgId : !!scopeTarget
  const [preview, setPreview] = useState<{ matched: number; names: string[]; enforceable: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = scopeReady && matchValue.trim() && !busy

  async function runPreview() {
    if (!scopeReady || !matchValue.trim()) return
    setBusy('preview'); setError(null); setPreview(null)
    try {
      const res = await fetch('/api/policy-rules/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scope, match_type: matchType, match_value: matchValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreview(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally { setBusy(null) }
  }

  async function create() {
    if (!canSubmit) return
    setBusy('create'); setError(null)
    try {
      const res = await fetch('/api/policy-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scope, match_type: matchType, match_value: matchValue.trim(), action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create rule')
      setMatchValue(''); setPreview(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create rule')
    } finally { setBusy(null) }
  }

  async function reapply(id: string) {
    setBusy(`apply-${id}`); setError(null)
    try {
      const res = await fetch(`/api/policy-rules/${id}`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error || 'Re-apply failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-apply failed')
    } finally { setBusy(null) }
  }

  async function remove(id: string) {
    setBusy(`del-${id}`); setError(null)
    try {
      const res = await fetch(`/api/policy-rules/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally { setBusy(null) }
  }

  const inputCls = 'rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none'

  return (
    <div className="space-y-8">
      {/* New rule */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">New rule</h2>
        {orgs.length === 0 ? (
          <p className="text-sm text-gray-500">No organizations available.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">
                Organization
                <select value={orgId} onChange={e => { setOrgId(e.target.value); setScopeTarget(''); setPreview(null) }} className={inputCls}>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">
                Apply to
                <select value={scopeKind} onChange={e => { setScopeKind(e.target.value as ScopeKind); setScopeTarget(''); setPreview(null) }} className={inputCls}>
                  <option value="org">Whole org</option>
                  <option value="location">A location</option>
                  <option value="device">A device</option>
                </select>
              </label>
              {scopeKind !== 'org' && (
                <label className="flex flex-col gap-1.5 text-xs text-gray-400">
                  {scopeKind === 'location' ? 'Location' : 'Device'}
                  <select value={scopeTarget} onChange={e => { setScopeTarget(e.target.value); setPreview(null) }} className={inputCls}>
                    <option value="">Select…</option>
                    {(scopeKind === 'location' ? orgLocations : orgDevices).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">
                Match on
                <select value={matchType} onChange={e => { setMatchType(e.target.value as MatchKind); setPreview(null) }} className={inputCls}>
                  <option value="publisher">Publisher</option>
                  <option value="path">Path</option>
                  <option value="name">Name</option>
                  <option value="hash">Hash (build)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400 lg:col-span-1">
                {matchType === 'hash' ? 'Value equals' : 'Value contains'}
                <input value={matchValue} onChange={e => { setMatchValue(e.target.value); setPreview(null) }}
                  placeholder={matchType === 'publisher' ? 'e.g. BitTorrent' : matchType === 'path' ? 'e.g. /Applications/Games' : matchType === 'hash' ? 'paste a sha256 build hash' : 'e.g. Torrent'}
                  className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">
                Action
                <select value={action} onChange={e => setAction(e.target.value as 'block' | 'allow')} className={inputCls}>
                  <option value="block">Block</option>
                  <option value="allow">Allow</option>
                </select>
              </label>
            </div>

            {matchType === 'hash' && (
              <p className="mt-3 text-xs text-gray-500">
                Matches the exact build (sha256 of the main executable, reported by agent v1.7.20+). Enforcement is per app, so a block affects all builds of the matched app, not just this one.
              </p>
            )}

            {preview && (
              <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm">
                <p className="text-gray-300">
                  Matches <span className="font-semibold text-white">{preview.matched}</span> app{preview.matched === 1 ? '' : 's'}
                  {action === 'block' && <span className="text-gray-500"> · {preview.enforceable} enforceable now</span>}
                </p>
                {preview.names.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {preview.names.join(', ')}{preview.matched > preview.names.length ? ', …' : ''}
                  </p>
                )}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="mt-4 flex items-center gap-2">
              <button onClick={runPreview} disabled={!orgId || !matchValue.trim() || !!busy}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:opacity-50">
                {busy === 'preview' ? 'Checking…' : 'Preview matches'}
              </button>
              <button onClick={create} disabled={!canSubmit}
                className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${action === 'block' ? 'bg-red-600/90 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'}`}>
                {busy === 'create' ? 'Creating…' : `Create ${action} rule`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Existing rules */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Active rules</h2>
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500">No rules yet.</p>
        ) : (
          <div className="space-y-2">
            {rules.map(r => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-white">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium mr-2 ${r.action === 'block' ? 'bg-red-500/15 text-red-300' : 'bg-blue-500/15 text-blue-300'}`}>
                      {r.action === 'block' ? 'Block' : 'Allow'}
                    </span>
                    {MATCH_LABEL[r.match_type] ?? r.match_type} contains “<span className="font-medium">{r.match_value}</span>”
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {r.scope_label} · matches {r.matched} app{r.matched === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => reapply(r.id)} disabled={!!busy}
                    className="rounded-md border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50">
                    {busy === `apply-${r.id}` ? '…' : 'Re-apply'}
                  </button>
                  <button onClick={() => remove(r.id)} disabled={!!busy}
                    className="rounded-md border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50">
                    {busy === `del-${r.id}` ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
