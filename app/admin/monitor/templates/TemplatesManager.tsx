'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ScopePicker, { type Scoped, type ScopeKind } from './ScopePicker'

type Item = { app: string; status: string }
type Template = { id: string; name: string; description: string | null; items: Item[] }
type Sel = { scope_type: ScopeKind; scope_id: string } | null

export default function TemplatesManager({
  templates, orgs, locations, devices, rings,
}: {
  templates: Template[]; orgs: Scoped[]; locations: Scoped[]; devices: Scoped[]; rings: Scoped[]
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [captureFrom, setCaptureFrom] = useState<Sel>(orgs[0] ? { scope_type: 'org', scope_id: orgs[0].id } : null)
  const [capture, setCapture] = useState(false)
  const [applyTo, setApplyTo] = useState<Record<string, Sel>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const pickerProps = { orgs, locations, devices, rings }

  async function create() {
    if (!name.trim() || busy) return
    setBusy('create'); setError(null); setMsg(null)
    try {
      const body: Record<string, unknown> = { name: name.trim(), description: description.trim() }
      if (capture && captureFrom) { body.from_scope_type = captureFrom.scope_type; body.from_scope_id = captureFrom.scope_id }
      const res = await fetch('/api/policy-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create template')
      setName(''); setDescription(''); setCapture(false)
      setMsg(capture ? `Created with ${data.items} rule${data.items === 1 ? '' : 's'}` : 'Template created')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create template')
    } finally { setBusy(null) }
  }

  async function apply(id: string) {
    const sel = applyTo[id]
    if (!sel) { setError('Choose where to apply the template'); return }
    setBusy(`apply-${id}`); setError(null); setMsg(null)
    try {
      const res = await fetch(`/api/policy-templates/${id}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sel),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Apply failed')
      setMsg(`Applied ${data.applied} change${data.applied === 1 ? '' : 's'}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed')
    } finally { setBusy(null) }
  }

  async function remove(id: string) {
    setBusy(`del-${id}`); setError(null)
    try {
      const res = await fetch(`/api/policy-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally { setBusy(null) }
  }

  const inputCls = 'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none'

  return (
    <div className="space-y-8">
      {/* New template */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">New template</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Standard blocklist)" className={inputCls} />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" className={inputCls} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={capture} onChange={e => setCapture(e.target.checked)} className="accent-blue-600" />
          Capture current policies from a scope
        </label>
        {capture && (
          <div className="mt-2">
            <ScopePicker {...pickerProps} onChange={setCaptureFrom} />
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
        <button onClick={create} disabled={!name.trim() || !!busy}
          className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {busy === 'create' ? 'Creating…' : 'Create template'}
        </button>
      </div>

      {/* Existing templates */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Templates</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">No templates yet.</p>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{t.name} <span className="text-xs text-gray-500">· {t.items.length} rule{t.items.length === 1 ? '' : 's'}</span></p>
                    {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                  </div>
                  <button onClick={() => remove(t.id)} disabled={!!busy}
                    className="rounded-md border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50 shrink-0">
                    {busy === `del-${t.id}` ? '…' : 'Delete'}
                  </button>
                </div>
                {t.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.items.slice(0, 12).map((it, i) => (
                      <span key={i} className={`rounded px-1.5 py-0.5 text-xs ${it.status === 'blocked' ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                        {it.app}
                      </span>
                    ))}
                    {t.items.length > 12 && <span className="text-xs text-gray-500 self-center">+{t.items.length - 12} more</span>}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3">
                  <span className="text-xs text-gray-500">Apply to</span>
                  <ScopePicker {...pickerProps} compact onChange={sel => setApplyTo(p => ({ ...p, [t.id]: sel }))} />
                  <button onClick={() => apply(t.id)} disabled={!!busy}
                    className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-blue-300 hover:border-blue-500/60 hover:bg-blue-600/10 disabled:opacity-50">
                    {busy === `apply-${t.id}` ? 'Applying…' : 'Apply'}
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
