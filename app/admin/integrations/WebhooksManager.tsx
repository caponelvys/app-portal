'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Org = { id: string; name: string }
type Endpoint = {
  id: string; url: string; enabled: boolean; scope: string
  last_status: string | null; last_delivered_at: string | null
}

export default function WebhooksManager({
  isGlobalAllowed, orgs, endpoints,
}: {
  isGlobalAllowed: boolean; orgs: Org[]; endpoints: Endpoint[]
}) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [orgId, setOrgId] = useState('')  // '' = all orgs (msp_admin only)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  const inputCls = 'rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none'

  async function create() {
    if (!url.trim() || busy) return
    setBusy('create'); setError(null); setNewSecret(null)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), org_id: orgId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add endpoint')
      setNewSecret(data.secret)
      setUrl('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add endpoint')
    } finally { setBusy(null) }
  }

  async function act(id: string, path: string, method: string, body?: object) {
    setBusy(`${path}-${id}`); setError(null); setTestMsg(null)
    try {
      const res = await fetch(`/api/webhooks/${id}${path}`, {
        method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Action failed')
      if (path === '/test') setTestMsg(data.success ? `Test delivered (HTTP ${data.status})` : `Test failed (${data.status || 'unreachable'})`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Add webhook endpoint</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/ravyn-webhook" className={`${inputCls} flex-1 min-w-[240px]`} />
          <select value={orgId} onChange={e => setOrgId(e.target.value)} className={inputCls}>
            {isGlobalAllowed && <option value="">All organizations</option>}
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={create} disabled={!url.trim() || !!busy}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {busy === 'create' ? 'Adding…' : 'Add'}
          </button>
        </div>
        {newSecret && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <p className="text-emerald-300">Endpoint added. Signing secret (shown once — save it to verify deliveries):</p>
            <p className="mt-1 font-mono text-xs text-emerald-200 break-all">{newSecret}</p>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Endpoints</h2>
        {testMsg && <p className="mb-2 text-sm text-blue-300">{testMsg}</p>}
        {endpoints.length === 0 ? (
          <p className="text-sm text-gray-500">No webhook endpoints yet.</p>
        ) : (
          <div className="space-y-2">
            {endpoints.map(e => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-white font-mono truncate">{e.url}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {e.scope}
                    {e.last_status && <> · last: {e.last_status}</>}
                    {!e.enabled && <span className="text-amber-400"> · disabled</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => act(e.id, '/test', 'POST')} disabled={!!busy}
                    className="rounded-md border border-gray-700 px-2.5 py-1 text-xs font-medium text-blue-300 hover:border-blue-500/50 disabled:opacity-50">
                    {busy === `/test-${e.id}` ? '…' : 'Send test'}
                  </button>
                  <button onClick={() => act(e.id, '', 'PATCH', { enabled: !e.enabled })} disabled={!!busy}
                    className="rounded-md border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50">
                    {e.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => act(e.id, '', 'DELETE')} disabled={!!busy}
                    className="rounded-md border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50">
                    Delete
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
