'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAppLogoUrl } from '@/lib/appLogos'
import { DURATIONS, durationLabel, expiresInLabel } from '@/lib/durations'

export type PortalApp = {
  id: string
  name: string
  description: string
  url: string
  icon_url: string | null
  category: string | null
}
export type PendingItem = { app: PortalApp; duration: string; requestedAt: string }
export type ExpiringItem = { app: PortalApp; expiresAt: string; duration: string }
export type ActiveItem = { app: PortalApp; expiresAt: string | null }

const TEMP_DURATIONS = DURATIONS.filter(d => d.ms != null)
const UNCATEGORIZED = 'Other'

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function AppLogo({ app, size = 40 }: { app: PortalApp; size?: number }) {
  const url = getAppLogoUrl(app.name, app.icon_url)
  const cls = 'rounded-lg object-contain bg-white p-1 shrink-0'
  if (url) return <img src={url} alt="" style={{ width: size, height: size }} className={cls} />
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-gray-400 shrink-0"
    >
      {app.name.charAt(0).toUpperCase()}
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</h2>
      {count != null && (
        <span className="rounded-full bg-gray-800 px-1.5 text-xs font-medium text-gray-400">{count}</span>
      )}
    </div>
  )
}

// ── Request / Extend modal ──────────────────────────────────────────────────
function RequestModal({
  app, onClose, onDone,
}: {
  app: PortalApp
  onClose: () => void
  onDone: () => void
}) {
  const [mode, setMode] = useState<'temporary' | 'permanent'>('temporary')
  const [duration, setDuration] = useState<string>('4h')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/app-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: app.id, duration: mode === 'permanent' ? 'permanent' : duration, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Failed to submit request'); return }
      onDone()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <AppLogo app={app} size={40} />
            <div>
              <h3 className="font-semibold text-white">Request access to {app.name}</h3>
              {app.description && <p className="text-xs text-gray-400">{app.description}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300" aria-label="Close">✕</button>
        </div>

        <p className="mb-2 text-sm font-medium text-gray-300">How long do you need it?</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          {([
            ['temporary', 'Temporary', 'Auto-revokes on a date'],
            ['permanent', 'Permanent', 'Stays until revoked'],
          ] as const).map(([val, title, sub]) => (
            <button
              key={val}
              onClick={() => setMode(val)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                mode === val ? 'border-blue-500 bg-blue-600/15' : 'border-gray-700 bg-gray-800/60 hover:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <span className={`h-3.5 w-3.5 rounded-full border ${mode === val ? 'border-blue-400 bg-blue-500' : 'border-gray-500'}`} />
                {title}
              </span>
              <span className="mt-0.5 block pl-6 text-xs text-gray-400">{sub}</span>
            </button>
          ))}
        </div>

        {mode === 'temporary' && (
          <div className="mb-4">
            <p className="mb-1.5 text-sm font-medium text-gray-300">Duration</p>
            <div className="flex flex-wrap gap-2">
              {TEMP_DURATIONS.map(d => (
                <button
                  key={d.code}
                  onClick={() => setDuration(d.code)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    duration === d.code ? 'border-blue-500 bg-blue-600/15 text-white' : 'border-gray-700 bg-gray-800/60 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="mb-1.5 text-sm font-medium text-gray-300">Business justification</p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Need it to review handoff files from the design team this sprint…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <p className="mt-1 text-xs text-gray-500">Helps your admin approve faster.</p>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-2.5 text-xs text-gray-400">
          <span aria-hidden>ⓘ</span>
          <span>Goes to your IT admin. Most requests are reviewed within a few hours.</span>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:text-white">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── "Can't find it?" — suggest an off-catalog app ───────────────────────────
function SuggestModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/app-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, reason }),
      })
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="py-2 text-center">
            <p className="text-lg font-semibold text-white">Sent to your admin</p>
            <p className="mt-1 text-sm text-gray-400">They&apos;ll review adding it to the catalog.</p>
            <button onClick={onClose} className="mt-5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Done</button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">Request an app</h3>
                <p className="text-xs text-gray-400">Not in the catalog? Tell your admin what you need.</p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300" aria-label="Close">✕</button>
            </div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">App name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Notion Calendar" className={`${inputCls} mb-4`} />
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Why do you need it?</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="What you'd use it for…" className={`${inputCls} mb-5`} />
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:text-white">Cancel</button>
              <button onClick={submit} disabled={submitting || !name.trim()} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Sending…' : 'Send to admin'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main portal view ────────────────────────────────────────────────────────
export default function PortalView({
  pending, expiring, active, catalog,
}: {
  pending: PendingItem[]
  expiring: ExpiringItem[]
  active: ActiveItem[]
  catalog: PortalApp[]
}) {
  const router = useRouter()
  const [modalApp, setModalApp] = useState<PortalApp | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>('All')

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const a of catalog) set.add(a.category || UNCATEGORIZED)
    return ['All', ...[...set].sort((a, b) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b)))]
  }, [catalog])

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.filter(a => {
      if (cat !== 'All' && (a.category || UNCATEGORIZED) !== cat) return false
      if (q && !(`${a.name} ${a.description}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [catalog, cat, query])

  async function cancelRequest(appId: string) {
    setCancelling(appId)
    try {
      await fetch('/api/app-requests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId }),
      })
      router.refresh()
    } finally {
      setCancelling(null)
    }
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Your apps</h1>
          <p className="mt-1 text-gray-400">Launch what you have, track requests, and browse the catalog.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search apps…"
            className="w-full rounded-lg border border-gray-700 bg-gray-900/70 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {/* Pending review */}
      {pending.length > 0 && (
        <section className="mb-8">
          <SectionHeader label="Pending review" count={pending.length} />
          <div className="space-y-2">
            {pending.map(({ app, duration, requestedAt }) => (
              <div key={app.id} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/70 p-3">
                <AppLogo app={app} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{app.name}</p>
                  <p className="text-xs text-gray-500">
                    {duration === 'permanent' ? 'Permanent' : `Temporary · ${durationLabel(duration)}`} · requested {timeAgo(requestedAt)}
                  </p>
                </div>
                <span className="rounded-full bg-amber-950/50 px-2.5 py-1 text-xs font-medium text-amber-300">Awaiting admin</span>
                <button
                  onClick={() => cancelRequest(app.id)}
                  disabled={cancelling === app.id}
                  className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                >
                  {cancelling === app.id ? 'Cancelling…' : 'Cancel request'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expiring soon */}
      {expiring.length > 0 && (
        <section className="mb-8">
          <SectionHeader label="Expiring soon" count={expiring.length} />
          <div className="space-y-2">
            {expiring.map(({ app, expiresAt, duration }) => {
              const d = DURATIONS.find(x => x.code === duration)
              const total = d?.ms ?? 24 * 3600e3
              const left = Math.max(0, new Date(expiresAt).getTime() - Date.now())
              const pct = Math.max(4, Math.min(100, (left / total) * 100))
              return (
                <div key={app.id} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/70 p-3">
                  <AppLogo app={app} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{app.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-800">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-amber-300">Ends {expiresInLabel(expiresAt).replace(' left', '')}</span>
                    </div>
                  </div>
                  <a href={app.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800">Open ↗</a>
                  <button onClick={() => setModalApp(app)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Extend</button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Active — ready to launch */}
      {active.length > 0 && (
        <section className="mb-8">
          <SectionHeader label="Active · ready to launch" count={active.length} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {active.map(({ app, expiresAt }) => (
              <div key={app.id} className="flex flex-col rounded-xl border border-gray-800 bg-gray-900/70 p-4 transition-colors hover:border-gray-700">
                <div className="mb-3 flex items-start justify-between">
                  <AppLogo app={app} size={40} />
                  {expiresAt && (
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-400">{expiresInLabel(expiresAt)}</span>
                  )}
                </div>
                <p className="font-semibold text-white">{app.name}</p>
                {app.description && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{app.description}</p>}
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 rounded-lg bg-gray-800 py-2 text-center text-sm font-medium text-white hover:bg-gray-700"
                >
                  Open ↗
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Browse & request */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SectionHeader label="Browse & request" />
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    cat === c ? 'bg-blue-600/20 text-blue-300' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredCatalog.length === 0 && (query || cat !== 'All') && (
          <p className="mb-3 text-sm text-gray-500">No apps match — try another category or request one below.</p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredCatalog.map(app => (
            <div key={app.id} className="flex flex-col rounded-xl border border-gray-800 bg-gray-900/70 p-4 transition-colors hover:border-gray-700">
              <AppLogo app={app} size={40} />
              <p className="mt-3 font-semibold text-white">{app.name}</p>
              {app.description && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{app.description}</p>}
              <button
                onClick={() => setModalApp(app)}
                className="mt-3 rounded-lg border border-gray-700 py-2 text-sm font-medium text-blue-300 hover:border-blue-500/60 hover:bg-blue-600/10"
              >
                Request access
              </button>
            </div>
          ))}
          {/* Off-catalog request */}
          <button
            onClick={() => setSuggestOpen(true)}
            className="flex flex-col items-start rounded-xl border border-dashed border-[#7C5CFF]/40 p-4 text-left shadow-[0_0_18px_2px_rgba(124,92,255,0.25)] transition-all hover:border-[#7C5CFF]/70 hover:bg-[#7C5CFF]/5 hover:shadow-[0_0_26px_4px_rgba(124,92,255,0.45)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 text-2xl leading-none text-gray-500">+</span>
            <span className="mt-3 font-semibold text-white">Can&apos;t find it?</span>
            <span className="mt-0.5 text-xs text-gray-500">Request an app that isn&apos;t in the catalog yet.</span>
          </button>
        </div>
      </section>

      {modalApp && (
        <RequestModal
          app={modalApp}
          onClose={() => setModalApp(null)}
          onDone={() => { setModalApp(null); router.refresh() }}
        />
      )}
      {suggestOpen && <SuggestModal onClose={() => setSuggestOpen(false)} />}
    </>
  )
}
