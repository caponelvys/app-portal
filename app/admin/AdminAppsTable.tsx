'use client'

import { useState } from 'react'
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

type ActKind = 'install' | 'uninstall' | 'delete'

export default function AdminAppsTable({ apps: initial, userId }: { apps: App[]; userId?: string }) {
  const [apps, setApps] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  // Inline two-click confirm + per-row status (no native confirm/prompt/alert,
  // which browsers can silently suppress).
  const [armed, setArmed] = useState<{ id: string; kind: ActKind } | null>(null)
  const [status, setStatus] = useState<{ id: string; text: string; error?: boolean } | null>(null)

  const isArmed = (app: App, kind: ActKind) => armed?.id === app.id && armed.kind === kind

  // First click on a destructive action arms it; second click runs it.
  function clickAction(app: App, kind: ActKind, run: () => void) {
    setStatus(null)
    if (!isArmed(app, kind)) { setArmed({ id: app.id, kind }); return }
    setArmed(null)
    run()
  }

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
    if (error) setStatus({ id: app.id, text: error.message, error: true })
    else setApps(apps.filter(a => a.id !== app.id))
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
      if (!res.ok) { setStatus({ id: app.id, text: data.error ?? 'Failed to queue', error: true }); return }
      const verb = action === 'install' ? 'Install' : 'Uninstall'
      setStatus({ id: app.id, text: `${verb} queued for ${data.queued} device${data.queued === 1 ? '' : 's'}. Watch the Agent Monitor.` })
    } catch {
      setStatus({ id: app.id, text: 'Network error', error: true })
    } finally {
      setLoading(null)
    }
  }

  const columns: ColDef<App>[] = [
    {
      id: 'app', label: 'App', defaultWidth: 240, sortable: true,
      sortValue: r => r.name,
      filter: { type: 'text', value: (r: App) => r.name + ' ' + r.description },
      renderCell: app => (
        <div className="flex items-center gap-2">
          {getAppLogoUrl(app.name, app.icon_url) ? (
            <img src={getAppLogoUrl(app.name, app.icon_url)!} alt={app.name} className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-gray-700 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-400 border border-gray-700 shrink-0">
              {app.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-white">{app.name}</p>
            <p className="text-xs text-gray-500">{app.description}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'url', label: 'URL', defaultWidth: 180, sortable: true,
      sortValue: r => r.url,
      filter: { type: 'text', value: (r: App) => r.url },
      renderCell: app => <span className="text-gray-500 text-xs truncate block max-w-[160px]">{app.url}</span>,
    },
    {
      id: 'status', label: 'Status', defaultWidth: 110, sortable: true,
      sortValue: r => r.status,
      filter: { type: 'select', value: (r: App) => r.status, options: [{ label: 'Allowed', value: 'allowed' }, { label: 'Blocked', value: 'blocked' }] },
      renderCell: app => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${app.status === 'allowed' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
          {app.status}
        </span>
      ),
    },
    {
      id: 'uninstall', label: 'Uninstall', defaultWidth: 150, sortable: false,
      filter: { type: 'select', value: (r: App) => overrideTags(r).length ? 'set' : 'heuristics', options: [{ label: 'Override set', value: 'set' }, { label: 'Heuristics only', value: 'heuristics' }] },
      renderCell: app => {
        const tags = overrideTags(app)
        if (tags.length === 0) return <span className="text-xs text-gray-600">Heuristics</span>
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-950 text-orange-300 border border-orange-800">{t}</span>
            ))}
          </div>
        )
      },
    },
    {
      id: 'actions', label: 'Actions', defaultWidth: 420, sortable: false,
      renderCell: app => (
        <div>
          <div className="flex items-center gap-2">
            <button onClick={() => toggleStatus(app)} disabled={loading === app.id}
              className={`text-xs px-3 py-1 rounded-md border font-medium disabled:opacity-50 ${app.status === 'allowed' ? 'border-red-700 text-red-400 hover:bg-red-900' : 'border-green-700 text-green-400 hover:bg-green-900'}`}>
              {app.status === 'allowed' ? 'Block' : 'Allow'}
            </button>
            <a href={`/admin/edit/${app.id}`} className="text-xs px-3 py-1 rounded-md border border-blue-700 text-blue-400 hover:bg-blue-900 font-medium">Edit</a>
            <button onClick={() => clickAction(app, 'install', () => fleetCommand(app, 'install'))} disabled={loading === app.id}
              className={`text-xs px-3 py-1 rounded-md border font-medium disabled:opacity-50 whitespace-nowrap ${isArmed(app, 'install') ? 'border-green-600 bg-green-700 text-white' : 'border-green-700 text-green-400 hover:bg-green-950'}`}>
              {isArmed(app, 'install') ? 'Confirm install' : 'Install to fleet'}
            </button>
            <button onClick={() => clickAction(app, 'uninstall', () => fleetCommand(app, 'uninstall'))} disabled={loading === app.id}
              className={`text-xs px-3 py-1 rounded-md border font-medium disabled:opacity-50 whitespace-nowrap ${isArmed(app, 'uninstall') ? 'border-orange-600 bg-orange-700 text-white' : 'border-orange-700 text-orange-400 hover:bg-orange-950'}`}>
              {isArmed(app, 'uninstall') ? 'Confirm uninstall' : 'Uninstall from fleet'}
            </button>
            <button onClick={() => clickAction(app, 'delete', () => deleteApp(app))} disabled={loading === app.id}
              className={`text-xs px-3 py-1 rounded-md border font-medium disabled:opacity-50 whitespace-nowrap ${isArmed(app, 'delete') ? 'border-red-600 bg-red-700 text-white' : 'border-red-800 text-red-500 hover:bg-red-900'}`}>
              {isArmed(app, 'delete') ? 'Confirm delete' : 'Delete'}
            </button>
          </div>
          {status?.id === app.id && <p className={`mt-1.5 text-xs ${status.error ? 'text-red-400' : 'text-green-400'}`}>{status.text}</p>}
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable storageId="apps-table" userId={userId} columns={columns} rows={apps} rowKey={r => r.id} emptyMessage="No apps yet. Add one above." />
    </>
  )
}
