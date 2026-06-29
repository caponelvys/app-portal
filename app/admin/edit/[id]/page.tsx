'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

const KNOWN_APP_LOGOS: Record<string, string> = {
  'Discord': 'discord.com',
  'Notion': 'notion.so',
  'Figma': 'figma.com',
  'Spotify': 'spotify.com',
  'Slack': 'slack.com',
  'Zoom': 'zoom.us',
  'WhatsApp': 'whatsapp.com',
  'Telegram': 'telegram.org',
  'Signal': 'signal.org',
  'Skype': 'skype.com',
  'Microsoft Teams': 'microsoft.com',
  'Teams': 'microsoft.com',
  'Outlook': 'microsoft.com',
  'Word': 'microsoft.com',
  'Excel': 'microsoft.com',
  'PowerPoint': 'microsoft.com',
  'OneNote': 'microsoft.com',
  'Visual Studio Code': 'code.visualstudio.com',
  'VS Code': 'code.visualstudio.com',
  'Xcode': 'developer.apple.com',
  'Android Studio': 'developer.android.com',
  'Steam': 'store.steampowered.com',
  'Epic Games': 'epicgames.com',
  'Twitch': 'twitch.tv',
  'OBS': 'obsproject.com',
  'OBS Studio': 'obsproject.com',
  'VLC': 'videolan.org',
  'Plex': 'plex.tv',
  '1Password': '1password.com',
  'LastPass': 'lastpass.com',
  'NordVPN': 'nordvpn.com',
  'ExpressVPN': 'expressvpn.com',
  'Dropbox': 'dropbox.com',
  'OneDrive': 'microsoft.com',
  'Gmail': 'mail.google.com',
  'Google Drive': 'drive.google.com',
  'Webex': 'webex.com',
  'FaceTime': 'apple.com',
  'Messages': 'apple.com',
  'Safari': 'apple.com',
  'Chrome': 'google.com',
  'Firefox': 'mozilla.org',
  'Opera': 'opera.com',
  'Brave': 'brave.com',
  'Arc': 'arc.net',
  'Photoshop': 'adobe.com',
  'Illustrator': 'adobe.com',
  'Premiere': 'adobe.com',
  'After Effects': 'adobe.com',
  'Lightroom': 'adobe.com',
  'Blender': 'blender.org',
  'Unity': 'unity.com',
  'Unreal Engine': 'unrealengine.com',
  'Minecraft': 'minecraft.net',
  'Roblox': 'roblox.com',
  'Fortnite': 'epicgames.com',
  'Valorant': 'playvalorant.com',
  'League of Legends': 'leagueoflegends.com',
  'Coinbase': 'coinbase.com',
  'Binance': 'binance.com',
  'Robinhood': 'robinhood.com',
  'CapCut': 'capcut.com',
  'Loom': 'loom.com',
  'Grammarly': 'grammarly.com',
  'Postman': 'postman.com',
  'Insomnia': 'insomnia.rest',
  'TablePlus': 'tableplus.com',
  'Sequel Pro': 'sequelpro.com',
  'GitHub Desktop': 'github.com',
  'Sourcetree': 'sourcetreeapp.com',
  'iTerm': 'iterm2.com',
  'Terminal': 'apple.com',
  'Alfred': 'alfredapp.com',
  'AutoCAD': 'autodesk.com',
  'Tower': 'git-tower.com',
}

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
  'Gmail': '',
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

export default function EditAppPage() {
  const { id } = useParams()
  const [form, setForm] = useState({ name: '', description: '', url: '', icon: '', status: 'allowed', process_name: '' })
  const [iconUrl, setIconUrl] = useState<string | null>(null)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [autoIconUrl, setAutoIconUrl] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('apps').select('*').eq('id', id).single()
      if (data) {
        setForm({ name: data.name, description: data.description, url: data.url, icon: data.icon, status: data.status, process_name: data.process_name ?? '' })
        setIconUrl(data.icon_url)
        const domain = KNOWN_APP_LOGOS[data.name]
        if (!data.icon_url && domain) {
          setAutoIconUrl(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`)
        }
      }
      setFetching(false)
    }
    load()
  }, [id])

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    const updated = { ...form, name: value }

    const exact = KNOWN_APPS[value]
    if (exact !== undefined) {
      if (exact) updated.process_name = exact
      const domain = KNOWN_APP_LOGOS[value]
      setAutoIconUrl(domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null)
    } else {
      setAutoIconUrl(null)
    }

    const matches = Object.keys(KNOWN_APPS).filter(k =>
      k.toLowerCase().startsWith(value.toLowerCase()) && value.length > 0
    )
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0 && !KNOWN_APPS[value])
    setForm(updated)
  }

  function selectSuggestion(name: string) {
    setForm({ ...form, name, process_name: KNOWN_APPS[name] })
    setSuggestions([])
    setShowSuggestions(false)
    const domain = KNOWN_APP_LOGOS[name]
    setAutoIconUrl(domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null)
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

    let icon_url: string | null = iconUrl ?? autoIconUrl

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

  const isKnown = !!KNOWN_APPS[form.name] || KNOWN_APPS[form.name] === ''
  const isCustom = form.name.length > 0 && !isKnown && suggestions.length === 0
  const inputClass = "w-full border border-gray-700 rounded-lg px-3 py-2 text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4">
        <a href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Back to Admin</a>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Edit App</h1>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <div className="relative">
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
              <p className="text-xs text-green-500 mt-1">App recognized — process name filled in automatically.</p>
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
              ) : autoIconUrl && !iconUrl ? (
                <img src={autoIconUrl} alt="app logo" className="w-12 h-12 rounded-lg object-contain bg-white p-1 border border-gray-700" />
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
