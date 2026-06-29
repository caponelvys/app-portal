'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const KNOWN_APPS: Record<string, string> = {
  'Discord': 'Discord',
  'Notion': 'Notion',
  'Figma': 'Figma',
  'Spotify': 'Spotify',
  'Slack': 'Slack',
  'Zoom': 'zoom.us',
  'WhatsApp': 'WhatsApp',
  'Telegram': 'Telegram',
  'Signal': 'Signal',
  'Skype': 'Skype',
  'Microsoft Teams': 'Teams',
  'Teams': 'Teams',
  'Outlook': 'Microsoft Outlook',
  'Word': 'Microsoft Word',
  'Excel': 'Microsoft Excel',
  'PowerPoint': 'Microsoft PowerPoint',
  'OneNote': 'Microsoft OneNote',
  'Visual Studio Code': 'Electron',
  'VS Code': 'Electron',
  'Xcode': 'Xcode',
  'Android Studio': 'studio',
  'Steam': 'steam',
  'Epic Games': 'EpicGamesLauncher',
  'Twitch': 'Twitch',
  'OBS': 'obs',
  'OBS Studio': 'obs',
  'VLC': 'VLC',
  'Plex': 'Plex',
  '1Password': '1Password 7',
  'LastPass': 'LastPass',
  'NordVPN': 'NordVPN',
  'ExpressVPN': 'ExpressVPN',
  'Dropbox': 'Dropbox',
  'OneDrive': 'OneDrive',
  'Google Drive': 'Google Drive',
  'Webex': 'Webex',
  'FaceTime': 'FaceTime',
  'Messages': 'Messages',
  'Safari': 'Safari',
  'Chrome': 'Google Chrome',
  'Firefox': 'firefox',
  'Opera': 'Opera',
  'Brave': 'Brave Browser',
  'Arc': 'Arc',
  'Photoshop': 'Adobe Photoshop',
  'Illustrator': 'Adobe Illustrator',
  'Premiere': 'Adobe Premiere Pro',
  'After Effects': 'After Effects',
  'Lightroom': 'Adobe Lightroom',
  'Blender': 'Blender',
  'Unity': 'Unity',
  'Unreal Engine': 'UnrealEditor',
  'Minecraft': 'java',
  'Roblox': 'RobloxPlayer',
  'Fortnite': 'FortniteClient',
  'Valorant': 'VALORANT',
  'League of Legends': 'LeagueClient',
  'Coinbase': 'Coinbase',
  'Binance': 'Binance',
  'Robinhood': 'Robinhood',
  'CapCut': 'CapCut',
  'Loom': 'Loom',
  'Grammarly': 'Grammarly Desktop',
  'Postman': 'Postman',
  'Insomnia': 'Insomnia',
  'TablePlus': 'TablePlus',
  'Sequel Pro': 'Sequel Pro',
  'GitHub Desktop': 'GitHub Desktop',
  'Sourcetree': 'SourceTree',
  'iTerm': 'iTerm2',
  'Terminal': 'Terminal',
  'Alfred': 'Alfred',
  'AutoCAD': 'acad',
  'Tower': 'Tower',
}

export default function NewAppPage() {
  const [form, setForm] = useState({ name: '', description: '', url: '', icon: '', status: 'allowed', process_name: '' })
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const nameRef = useRef<HTMLDivElement>(null)

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    const updated = { ...form, name: value }

    const exact = KNOWN_APPS[value]
    if (exact) updated.process_name = exact

    const matches = Object.keys(KNOWN_APPS).filter(k =>
      k.toLowerCase().startsWith(value.toLowerCase()) && value.length > 0
    )
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0 && !exact)
    setForm(updated)
  }

  function selectSuggestion(name: string) {
    setForm({ ...form, name, process_name: KNOWN_APPS[name] })
    setSuggestions([])
    setShowSuggestions(false)
  }

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

  const isKnown = !!KNOWN_APPS[form.name]
  const isCustom = form.name.length > 0 && !isKnown && suggestions.length === 0
  const inputClass = "w-full border border-gray-700 rounded-lg px-3 py-2 text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4">
        <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Back to Admin</a>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Add New App</h1>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <div className="relative" ref={nameRef}>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleNameChange}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              required
              autoComplete="off"
              className={inputClass}
            />
            {showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
                {suggestions.slice(0, 6).map(name => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={() => selectSuggestion(name)}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 flex items-center justify-between"
                  >
                    <span>{name}</span>
                    <span className="text-xs text-gray-500">{KNOWN_APPS[name]}</span>
                  </button>
                ))}
              </div>
            )}
            {isKnown && (
              <p className="text-xs text-green-500 mt-1">✓ Known app — process name auto-filled.</p>
            )}
            {isCustom && (
              <p className="text-xs text-blue-400 mt-1">Custom app — enter the process name manually below.</p>
            )}
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
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-400 border border-gray-700">
                  {form.name.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleFileChange}
                className="text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-gray-600 file:text-sm file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Optional. Leave empty to show the app's initial letter.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Process Name</label>
            <input name="process_name" value={form.process_name} onChange={handleChange}
              placeholder="e.g. Spotify or Spotify.exe" className={inputClass} />
            <p className="text-xs text-gray-500 mt-1">Leave empty for web-only apps like Gmail or Google Drive.</p>
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
            {loading ? 'Saving...' : 'Add App'}
          </button>
        </form>
      </main>
    </div>
  )
}
