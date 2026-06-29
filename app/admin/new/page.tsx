'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function NewAppPage() {
  const [form, setForm] = useState({ name: '', description: '', url: '', icon: '🔗', status: 'allowed', process_name: '' })
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIconFile(file)
    setIconPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    let icon_url = null

    if (iconFile) {
      const ext = iconFile.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('app-icons')
        .upload(fileName, iconFile)

      if (uploadError) {
        setError(uploadError.message)
        setLoading(false)
        return
      }

      const { data } = supabase.storage.from('app-icons').getPublicUrl(fileName)
      icon_url = data.publicUrl
    }

    const { error } = await supabase.from('apps').insert([{ ...form, icon_url }])

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/admin'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <a href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Back to Admin</a>
      </header>

      <main className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Add New App</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input name="name" value={form.name} onChange={handleChange} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input name="url" value={form.url} onChange={handleChange} required type="url"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon Image</label>
            <div className="flex items-center gap-4">
              {iconPreview ? (
                <img src={iconPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-2xl border border-gray-200">
                  {form.icon}
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleFileChange}
                className="text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-gray-200 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50" />
            </div>
            <p className="text-xs text-gray-400 mt-1">Upload an image, or leave empty to use the emoji below.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fallback Emoji</label>
            <input name="icon" value={form.icon} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Process Name</label>
            <input name="process_name" value={form.process_name} onChange={handleChange}
              placeholder="e.g. Spotify or Spotify.exe"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">The exact process name the agent will watch for. Leave empty if you only want this as a portal link.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="allowed">Allowed</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {loading ? 'Saving...' : 'Add App'}
          </button>
        </form>
      </main>
    </div>
  )
}
