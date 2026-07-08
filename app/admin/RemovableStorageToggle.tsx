'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'allow' | 'block'
type Scope = 'org' | 'location' | 'device' | 'ring'

const OPTIONS: { value: Mode | 'inherit'; label: string }[] = [
  { value: 'allow', label: 'Allow' },
  { value: 'block', label: 'Block' },
  { value: 'inherit', label: 'Inherit' },
]

export default function RemovableStorageToggle({
  scope, scopeId, current, effective,
}: {
  scope: Scope
  scopeId: string
  /** Mode set directly on this scope, or null when it inherits. */
  current: Mode | null
  /** Resolved effective mode (for the inherit hint). Omit for org. */
  effective?: Mode
}) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Org is the top of the hierarchy — no "inherit".
  const options = scope === 'org' ? OPTIONS.filter(o => o.value !== 'inherit') : OPTIONS
  const active: Mode | 'inherit' = current ?? 'inherit'

  async function set(mode: Mode | 'inherit') {
    if (mode === active || saving) return
    setSaving(mode); setError(null)
    try {
      const res = await fetch('/api/removable-storage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, scopeId, mode }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update')
    } finally { setSaving(null) }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="inline-flex rounded-lg border border-gray-700 bg-gray-900 p-0.5 w-fit">
        {options.map(o => {
          const isActive = o.value === active
          const isBlock = o.value === 'block'
          return (
            <button
              key={o.value}
              onClick={() => set(o.value)}
              disabled={!!saving}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-60 ${
                isActive
                  ? isBlock ? 'bg-red-500/20 text-red-300' : 'bg-blue-600/20 text-blue-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {saving === o.value ? '…' : o.label}
            </button>
          )
        })}
      </div>
      {active === 'inherit' && effective && (
        <p className="text-xs text-gray-500">Inherits <span className="text-gray-400">{effective}</span> from a parent scope.</p>
      )}
      {active === 'block' && (
        <p className="text-xs text-red-400/80">USB drives are ejected (macOS) / blocked (Windows) on these devices.</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
