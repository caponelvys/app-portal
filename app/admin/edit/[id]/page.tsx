'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

export default function EditAppPage() {
  const { id } = useParams()
  const [form, setForm] = useState({ name: '', description: '', url: '', icon: '', status: 'allowed', process_name: '' })
  const [iconUrl, setIconUrl] = useState<string | null>(null)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('apps').select('*').eq('id', id).single()
      if (data) {
        setForm({ name: data.name, description: data.description, url: data.url, icon: data.icon, status: data.status, process_name: data.process_name ?? '' })
        setIconUrl(data.icon_url)
      }
      setFetching(false)
    }
    load()
  }, [id])

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

    let icon_url = iconUrl

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

    const { error } = await supabase.from('apps').update({ ...form, icon_url }).eq('id', id)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/admin'
    }
  }

  if (fetching) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Loading...</div>

  const inputClass = "w-full border border-gray-700 rounded-lg px-3 py-2 text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4">
        <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Back to Admin</a>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Edit App</h1>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input name="name" value={form.name} onChange={handleChange} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">URL</label>
            <input name="url" value={form.url} onChange={handleChange} required type="url" className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Icon Image</label>
            <div className="flex items-center gap-4">
              {iconPreview ? (
                <img src={iconPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-gray-700" />
              ) : iconUrl ? (
                <img src={iconUrl} alt="current icon" className="w-12 h-12 rounded-lg object-cover border border-gray-700" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-400 border border-gray-700">
                  {form.name.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleFileChange}
                className="text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-gray-600 file:text-sm file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Upload a new image to replace the current one.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Process Name</label>
            <input name="process_name" value={form.process_name} onChange={handleChange}
              placeholder="e.g. Figma or Figma.exe" className={inputClass} />
            <p className="text-xs text-gray-500 mt-1">The exact process name the agent will watch for on enrolled devices.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
              <option value="allowed">Allowed</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </main>
    </div>
  )
}
