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

export default function AdminAppsTable({ apps: initial, userId }: { apps: App[]; userId?: string }) {
  const [apps, setApps] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)

  async function toggleStatus(app: App) {
    setLoading(app.id)
    const newStatus = app.status === 'allowed' ? 'blocked' : 'allowed'
    const { error } = await supabase.from('apps').update({ status: newStatus }).eq('id', app.id)
    if (!error) setApps(apps.map(a => a.id === app.id ? { ...a, status: newStatus } : a))
    setLoading(null)
  }

  async function deleteApp(id: string) {
    if (!confirm('Delete this app?')) return
    setLoading(id)
    const { error } = await supabase.from('apps').delete().eq('id', id)
    if (!error) setApps(apps.filter(a => a.id !== id))
    setLoading(null)
  }

  // Queue a remote install of this app on every device in scope. Devices whose
  // OS installer isn't configured (e.g. no mac_install_url) report a failure.
  async function installFleet(app: App) {
    if (!confirm(`Install "${app.name}" on ALL devices in your scope?\n\nDevices without an installer configured for their OS will report a failure.`)) return
    setLoading(app.id)
    try {
      const res = await fetch(`/api/apps/${app.id}/install`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'fleet' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error ?? 'Failed to queue install'); return }
      alert(`Install queued for ${data.queued} device${data.queued === 1 ? '' : 's'}. Watch the Agent Monitor for results.`)
    } catch {
      alert('Network error')
    } finally {
      setLoading(null)
    }
  }

  // Queue a remote uninstall of this app on every device in scope. Destructive
  // and irreversible on the devices — require typing the app name to confirm.
  async function uninstallFleet(app: App) {
    const typed = prompt(`Uninstall "${app.name}" from ALL devices in your scope?\n\nThis removes the app from every machine where it is found and cannot be undone. Type the app name to confirm.`)
    if (typed !== app.name) return
    setLoading(app.id)
    try {
      const res = await fetch(`/api/apps/${app.id}/uninstall`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'fleet' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error ?? 'Failed to queue uninstall'); return }
      alert(`Uninstall queued for ${data.queued} device${data.queued === 1 ? '' : 's'}. Watch the Agent Monitor for results.`)
    } catch {
      alert('Network error')
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
      id: 'actions', label: 'Actions', defaultWidth: 400, sortable: false,
      renderCell: app => (
        <div className="flex items-center gap-2">
          <button onClick={() => toggleStatus(app)} disabled={loading === app.id}
            className={`text-xs px-3 py-1 rounded-md border font-medium disabled:opacity-50 ${app.status === 'allowed' ? 'border-red-700 text-red-400 hover:bg-red-900' : 'border-green-700 text-green-400 hover:bg-green-900'}`}>
            {app.status === 'allowed' ? 'Block' : 'Allow'}
          </button>
          <a href={`/admin/edit/${app.id}`} className="text-xs px-3 py-1 rounded-md border border-blue-700 text-blue-400 hover:bg-blue-900 font-medium">Edit</a>
          <button onClick={() => installFleet(app)} disabled={loading === app.id}
            className="text-xs px-3 py-1 rounded-md border border-green-700 text-green-400 hover:bg-green-950 disabled:opacity-50 font-medium whitespace-nowrap">
            Install to fleet
          </button>
          <button onClick={() => uninstallFleet(app)} disabled={loading === app.id}
            className="text-xs px-3 py-1 rounded-md border border-orange-700 text-orange-400 hover:bg-orange-950 disabled:opacity-50 font-medium whitespace-nowrap">
            Uninstall from fleet
          </button>
          <button onClick={() => deleteApp(app.id)} disabled={loading === app.id}
            className="text-xs px-3 py-1 rounded-md border border-red-800 text-red-500 hover:bg-red-900 disabled:opacity-50 font-medium">
            Delete
          </button>
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
