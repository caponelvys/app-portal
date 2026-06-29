'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type App = {
  id: string
  name: string
  description: string
  url: string
  icon: string
  status: 'allowed' | 'blocked'
}

export default function AdminAppsTable({ apps: initial }: { apps: App[] }) {
  const [apps, setApps] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)

  async function toggleStatus(app: App) {
    setLoading(app.id)
    const newStatus = app.status === 'allowed' ? 'blocked' : 'allowed'

    const { error } = await supabase
      .from('apps')
      .update({ status: newStatus })
      .eq('id', app.id)

    if (!error) {
      setApps(apps.map(a => a.id === app.id ? { ...a, status: newStatus } : a))
    }
    setLoading(null)
  }

  async function deleteApp(id: string) {
    if (!confirm('Delete this app?')) return
    setLoading(id)

    const { error } = await supabase.from('apps').delete().eq('id', id)

    if (!error) {
      setApps(apps.filter(a => a.id !== id))
    }
    setLoading(null)
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead className="bg-gray-800 border-b border-gray-700">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-400">App</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">URL</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {apps.map(app => (
            <tr key={app.id} className="border-b border-gray-800 hover:bg-gray-800">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-400 border border-gray-700 shrink-0">
                    {app.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{app.name}</p>
                    <p className="text-xs text-gray-500">{app.description}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[160px]">
                {app.url}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  app.status === 'allowed'
                    ? 'bg-green-900 text-green-400'
                    : 'bg-red-900 text-red-400'
                }`}>
                  {app.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(app)}
                    disabled={loading === app.id}
                    className={`text-xs px-3 py-1 rounded-md border font-medium disabled:opacity-50 ${
                      app.status === 'allowed'
                        ? 'border-red-700 text-red-400 hover:bg-red-900'
                        : 'border-green-700 text-green-400 hover:bg-green-900'
                    }`}
                  >
                    {app.status === 'allowed' ? 'Block' : 'Allow'}
                  </button>
                  <a
                    href={`/admin/edit/${app.id}`}
                    className="text-xs px-3 py-1 rounded-md border border-blue-700 text-blue-400 hover:bg-blue-900 font-medium"
                  >
                    Edit
                  </a>
                  <button
                    onClick={() => deleteApp(app.id)}
                    disabled={loading === app.id}
                    className="text-xs px-3 py-1 rounded-md border border-red-800 text-red-500 hover:bg-red-900 disabled:opacity-50 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {apps.length === 0 && (
        <p className="text-center text-gray-500 py-10">No apps yet. Add one above.</p>
      )}
    </div>
  )
}
