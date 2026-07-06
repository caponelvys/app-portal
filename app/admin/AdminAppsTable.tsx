'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getAppLogoUrl } from '@/lib/appLogos'
import DataTable, { ColDef } from './DataTable'

type App = {
  id: string
  name: string
  description: string
  url: string
  icon: string
  icon_url: string | null
  status: 'allowed' | 'blocked'
  mac_app_path: string | null
  windows_uninstall: string | null
  linux_package: string | null
}

// Which OS-specific uninstall overrides an app has set (empty = heuristics).
function overrideTags(app: App): string[] {
  return [
    app.mac_app_path && 'macOS',
    app.windows_uninstall && 'Windows',
    app.linux_package && 'Linux',
  ].filter(Boolean) as string[]
}

// ⋮ overflow menu — Install / Uninstall / Delete. Rendered with fixed
// positioning so it isn't clipped by the table's overflow-x container. Each item
// is a two-click confirm; clicking elsewhere dismisses.
function ActionMenu({
  busy, onInstall, onUninstall, onDelete,
}: {
  busy: boolean
  onInstall: () => void
  onUninstall: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [armed, setArmed] = useState<'install' | 'uninstall' | 'delete' | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) { setOpen(false); setArmed(null) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: Math.max(8, r.right - 184) })
    }
    setArmed(null)
    setOpen(o => !o)
  }

  function run(kind: 'install' | 'uninstall' | 'delete', fn: () => void) {
    if (armed !== kind) { setArmed(kind); return }
    setArmed(null); setOpen(false); fn()
  }

  const itemCls = 'flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-gray-800'

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={busy}
        aria-label="More actions"
        className="rounded-md border border-gray-700 px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-50"
      >
        ⋮
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-44 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-2xl"
        >
          <button className={itemCls} onClick={() => run('install', onInstall)}>
            <span className="text-gray-200">Install to fleet</span>
            {armed === 'install' && <span className="text-xs font-medium text-blue-300">Confirm</span>}
          </button>
          <button className={itemCls} onClick={() => run('uninstall', onUninstall)}>
            <span className="text-gray-200">Uninstall from fleet</span>
            {armed === 'uninstall' && <span className="text-xs font-medium text-orange-300">Confirm</span>}
          </button>
          <div className="my-1 border-t border-gray-800" />
          <button className={itemCls} onClick={() => run('delete', onDelete)}>
            <span className="text-red-400">Delete app</span>
            {armed === 'delete' && <span className="text-xs font-medium text-red-300">Confirm</span>}
          </button>
        </div>
      )}
    </>
  )
}

export default function AdminAppsTable({ apps: initial, userId }: { apps: App[]; userId?: string }) {
  const [apps, setApps] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  async function toggleStatus(app: App) {
    setLoading(app.id)
    const newStatus = app.status === 'allowed' ? 'blocked' : 'allowed'
    const { error } = await supabase.from('apps').update({ status: newStatus }).eq('id', app.id)
    if (!error) setApps(apps.map(a => a.id === app.id ? { ...a, status: newStatus } : a))
    setLoading(null)
  }

  async function deleteApp(app: App) {
    setLoading(app.id)
    setStatus(null)
    const { error } = await supabase.from('apps').delete().eq('id', app.id)
    if (error) setStatus({ text: error.message, error: true })
    else { setApps(apps.filter(a => a.id !== app.id)); setStatus({ text: `Deleted "${app.name}".` }) }
    setLoading(null)
  }

  async function fleetCommand(app: App, action: 'install' | 'uninstall') {
    setLoading(app.id)
    setStatus(null)
    try {
      const res = await fetch(`/api/apps/${app.id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'fleet' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus({ text: data.error ?? 'Failed to queue', error: true }); return }
      const verb = action === 'install' ? 'Install' : 'Uninstall'
      setStatus({ text: `${verb} queued for ${data.queued} device${data.queued === 1 ? '' : 's'}. Watch the Agent Monitor.` })
    } catch {
      setStatus({ text: 'Network error', error: true })
    } finally {
      setLoading(null)
    }
  }

  const columns: ColDef<App>[] = [
    {
      id: 'app', label: 'App', defaultWidth: 260, sortable: true,
      sortValue: r => r.name,
      filter: { type: 'text', value: (r: App) => r.name + ' ' + r.description },
      renderCell: app => (
        <div className="flex items-center gap-2.5">
          {getAppLogoUrl(app.name, app.icon_url) ? (
            <img src={getAppLogoUrl(app.name, app.icon_url)!} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-gray-700 bg-white object-contain p-0.5" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-sm font-bold text-gray-400">
              {app.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-white">{app.name}</p>
            <p className="truncate text-xs text-gray-500">{app.description}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'url', label: 'URL', defaultWidth: 200, sortable: true,
      sortValue: r => r.url,
      filter: { type: 'text', value: (r: App) => r.url },
      renderCell: app => <span className="block max-w-[220px] truncate text-xs text-gray-500">{app.url}</span>,
    },
    {
      id: 'status', label: 'Status', defaultWidth: 120, sortable: true,
      sortValue: r => r.status,
      filter: { type: 'select', value: (r: App) => r.status, options: [{ label: 'Allowed', value: 'allowed' }, { label: 'Blocked', value: 'blocked' }] },
      renderCell: app => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium">
          <span className={`h-1.5 w-1.5 rounded-full ${app.status === 'allowed' ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className={app.status === 'allowed' ? 'text-green-400' : 'text-red-400'}>{app.status}</span>
        </span>
      ),
    },
    {
      id: 'uninstall', label: 'Uninstall', defaultWidth: 140, sortable: false,
      filter: { type: 'select', value: (r: App) => overrideTags(r).length ? 'set' : 'heuristics', options: [{ label: 'Override set', value: 'set' }, { label: 'Heuristics only', value: 'heuristics' }] },
      renderCell: app => {
        const tags = overrideTags(app)
        if (tags.length === 0) return <span className="text-xs text-gray-600">Heuristics</span>
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map(t => (
              <span key={t} className="rounded-full border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">{t}</span>
            ))}
          </div>
        )
      },
    },
    {
      id: 'actions', label: 'Actions', defaultWidth: 150, sortable: false,
      renderCell: app => (
        <div className="flex items-center gap-2">
          {/* Policy toggle — the one colored action, so state is what the eye catches. */}
          <button
            onClick={() => toggleStatus(app)}
            disabled={loading === app.id}
            className={`rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
              app.status === 'allowed'
                ? 'border-red-800/70 text-red-400 hover:bg-red-950/50'
                : 'border-green-800/70 text-green-400 hover:bg-green-950/50'
            }`}
          >
            {app.status === 'allowed' ? 'Block' : 'Allow'}
          </button>
          {/* Edit — neutral */}
          <a
            href={`/admin/edit/${app.id}`}
            className="rounded-md border border-gray-700 px-3 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Edit
          </a>
          <ActionMenu
            busy={loading === app.id}
            onInstall={() => fleetCommand(app, 'install')}
            onUninstall={() => fleetCommand(app, 'uninstall')}
            onDelete={() => deleteApp(app)}
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable storageId="apps-table" userId={userId} columns={columns} rows={apps} rowKey={r => r.id} emptyMessage="No apps yet. Add one above." />
      {status && (
        <div
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-2.5 text-sm shadow-2xl ${
            status.error ? 'border-red-800 bg-red-950 text-red-300' : 'border-green-800 bg-green-950 text-green-300'
          }`}
          onClick={() => setStatus(null)}
          role="status"
        >
          {status.text}
        </div>
      )}
    </>
  )
}
