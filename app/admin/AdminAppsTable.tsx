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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">App</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">URL</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {apps.map(app => (
            <tr key={app.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{app.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{app.name}</p>
                    <p className="text-xs text-gray-400">{app.description}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[160px]">
                {app.url}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  app.status === 'allowed'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-600'
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
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-green-200 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {app.status === 'allowed' ? 'Block' : 'Allow'}
                  </button>
                  <a
                    href={`/admin/edit/${app.id}`}
                    className="text-xs px-3 py-1 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium"
                  >
                    Edit
                  </a>
                  <button
                    onClick={() => deleteApp(app.id)}
                    disabled={loading === app.id}
                    className="text-xs px-3 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 font-medium"
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
        <p className="text-center text-gray-400 py-10">No apps yet. Add one above.</p>
      )}
    </div>
  )
}
