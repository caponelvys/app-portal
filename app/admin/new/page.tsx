'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const KNOWN_PROCESSES: Record<string, string> = {
  'discord': 'Discord',
  'notion': 'Notion',
  'figma': 'Figma',
  'spotify': 'Spotify',
  'slack': 'Slack',
  'zoom': 'zoom.us',
  'whatsapp': 'WhatsApp',
  'telegram': 'Telegram',
  'signal': 'Signal',
  'skype': 'Skype',
  'microsoft teams': 'Teams',
  'teams': 'Teams',
  'outlook': 'Microsoft Outlook',
  'word': 'Microsoft Word',
  'excel': 'Microsoft Excel',
  'powerpoint': 'Microsoft PowerPoint',
  'onenote': 'Microsoft OneNote',
  'visual studio code': 'Electron',
  'vs code': 'Electron',
  'vscode': 'Electron',
  'xcode': 'Xcode',
  'android studio': 'studio',
  'steam': 'steam',
  'epic games': 'EpicGamesLauncher',
  'twitch': 'Twitch',
  'obs': 'obs',
  'obs studio': 'obs',
  'vlc': 'VLC',
  'plex': 'Plex',
  'spotify': 'Spotify',
  '1password': '1Password 7',
  'lastpass': 'LastPass',
  'nordvpn': 'NordVPN',
  'expressvpn': 'ExpressVPN',
  'dropbox': 'Dropbox',
  'onedrive': 'OneDrive',
  'google drive': 'Google Drive',
  'zoom': 'zoom.us',
  'webex': 'Webex',
  'facetime': 'FaceTime',
  'imessage': 'Messages',
  'messages': 'Messages',
  'mail': 'Mail',
  'safari': 'Safari',
  'chrome': 'Google Chrome',
  'firefox': 'firefox',
  'opera': 'Opera',
  'brave': 'Brave Browser',
  'arc': 'Arc',
  'tor': 'firefox',
  'adobe photoshop': 'Adobe Photoshop',
  'photoshop': 'Adobe Photoshop',
  'illustrator': 'Adobe Illustrator',
  'premiere': 'Adobe Premiere Pro',
  'after effects': 'After Effects',
  'lightroom': 'Adobe Lightroom',
  'autocad': 'acad',
  'blender': 'Blender',
  'unity': 'Unity',
  'unreal': 'UnrealEditor',
  'minecraft': 'java',
  'roblox': 'RobloxPlayer',
  'fortnite': 'FortniteClient',
  'valorant': 'VALORANT',
  'league of legends': 'LeagueClient',
  'coinbase': 'Coinbase',
  'binance': 'Binance',
  'robinhood': 'Robinhood',
  'capcut': 'CapCut',
  'loom': 'Loom',
  'grammarly': 'Grammarly Desktop',
  'alfred': 'Alfred',
  'bartender': 'Bartender 4',
  'iterm': 'iTerm2',
  'terminal': 'Terminal',
  'postman': 'Postman',
  'insomnia': 'Insomnia',
  'tableplus': 'TablePlus',
  'sequel pro': 'Sequel Pro',
  'sourcetree': 'SourceTree',
  'github desktop': 'GitHub Desktop',
  'tower': 'Tower',
}

export default function NewAppPage() {
  const [form, setForm] = useState({ name: '', description: '', url: '', icon: '', status: 'allowed', process_name: '' })
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const updated = { ...form, [e.target.name]: e.target.value }
    if (e.target.name === 'name') {
      const match = KNOWN_PROCESSES[e.target.value.toLowerCase().trim()]
      if (match) updated.process_name = match
    }
    setForm(updated)
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

  const inputClass = "w-full border border-gray-700 rounded-lg px-3 py-2 text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4">
        <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Back to Admin</a>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Add New App</h1>

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
            <p className="text-xs text-gray-500 mt-1">
              {KNOWN_PROCESSES[form.name.toLowerCase().trim()]
                ? '✓ Auto-filled based on app name. You can override it.'
                : 'The exact process name the agent will watch for. Leave empty if you only want this as a portal link.'}
            </p>
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
