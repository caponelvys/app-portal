'use client'

import { useState } from 'react'
import { getAppLogoUrl } from '@/lib/appLogos'
import type { PolicyApp, PolicyStatus, ScopeType } from '@/lib/policy'

type Choice = 'inherit' | PolicyStatus

function Row({ app, scopeType, scopeId }: { app: PolicyApp; scopeType: ScopeType; scopeId: string }) {
  const [override, setOverride] = useState<PolicyStatus | null>(app.override)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const effective: PolicyStatus = override ?? app.inherited
  const choice: Choice = override ?? 'inherit'

  async function change(next: Choice) {
    if (next === choice) return
    setBusy(true)
    setError('')
    const prev = override
    setOverride(next === 'inherit' ? null : next) // optimistic
    try {
      const res = await fetch('/api/policies', {
        method: next === 'inherit' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: app.id,
          scope_type: scopeType,
          scope_id: scopeId,
          ...(next !== 'inherit' ? { status: next } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setOverride(prev) // revert
        setError(data.error ?? 'Failed to save')
      }
    } catch {
      setOverride(prev)
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  const logo = getAppLogoUrl(app.name, app.icon_url)

  return (
    <tr className="border-b border-gray-800">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt={app.name} className="w-7 h-7 rounded object-contain bg-white p-0.5" />
          ) : (
            <div className="w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 border border-gray-700">
              {app.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-white">{app.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {override === null ? (
          <span className="text-xs text-gray-500">
            Inherited · <span className={app.inherited === 'blocked' ? 'text-red-400' : 'text-green-400'}>{app.inherited}</span>
          </span>
        ) : (
          <span className={`text-xs font-medium ${effective === 'blocked' ? 'text-red-400' : 'text-green-400'}`}>
            Override · {effective}
          </span>
        )}
        {error && <span className="block text-xs text-red-400">{error}</span>}
      </td>
      <td className="px-4 py-3">
        <div className="inline-flex rounded-lg overflow-hidden border border-gray-700">
          {(['inherit', 'allowed', 'blocked'] as Choice[]).map(opt => {
            const active = choice === opt
            const color =
              opt === 'allowed' ? 'bg-green-700 text-white'
              : opt === 'blocked' ? 'bg-red-800 text-white'
              : 'bg-gray-700 text-white'
            return (
              <button
                key={opt}
                onClick={() => change(opt)}
                disabled={busy}
                className={`px-3 py-1.5 text-xs capitalize disabled:opacity-50 ${active ? color : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </td>
    </tr>
  )
}

export default function PolicyEditor({
  scopeType,
  scopeId,
  apps,
}: {
  scopeType: ScopeType
  scopeId: string
  apps: PolicyApp[]
}) {
  if (apps.length === 0) return <p className="text-gray-500 text-sm">No apps in the catalog yet.</p>
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-gray-800 border-b border-gray-700">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-400">App</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Effective</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Policy at this level</th>
          </tr>
        </thead>
        <tbody>
          {apps.map(app => (
            <Row key={app.id} app={app} scopeType={scopeType} scopeId={scopeId} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
