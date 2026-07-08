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

// Known-good macOS installer URLs (stable "latest" links that redirect to the
// current .pkg/.dmg — the agent follows redirects). Auto-filled for recognized
// apps so admins don't hunt for them; still editable. Don't pair these with a
// checksum since "latest" changes each release.
const CHROME_DMG = 'https://dl.google.com/chrome/mac/universal/stable/GGRO/googlechrome.dmg'
const VSCODE_ZIP = 'https://update.code.visualstudio.com/latest/darwin-universal/stable'
const TEAMS_PKG = 'https://go.microsoft.com/fwlink/?linkid=869428'
const KNOWN_MAC_INSTALLERS: Record<string, string> = {
  // All verified to resolve to a real .pkg/.dmg/.zip the agent handles.
  'Notion': 'https://www.notion.so/desktop/mac/download',
  'Zoom': 'https://zoom.us/client/latest/zoomusInstallerFull.pkg',
  'Chrome': CHROME_DMG,
  'Google Chrome': CHROME_DMG,
  'Discord': 'https://discord.com/api/download?platform=osx&format=dmg',
  'Slack': 'https://slack.com/ssb/download-osx-universal',
  'Telegram': 'https://telegram.org/dl/macos',
  'Firefox': 'https://download.mozilla.org/?product=firefox-latest-ssl&os=osx&lang=en-US',
  'Brave': 'https://laptop-updates.brave.com/latest/osx',
  'Arc': 'https://releases.arc.net/release/Arc-latest.dmg',
  'Google Drive': 'https://dl.google.com/drive-file-stream/GoogleDrive.dmg',
  'Grammarly': 'https://download-mac.grammarly.com/Grammarly.dmg',
  'Steam': 'https://cdn.cloudflare.steamstatic.com/client/installer/steam.dmg',
  'Minecraft': 'https://launcher.mojang.com/download/Minecraft.dmg',
  'NordVPN': 'https://downloads.nordcdn.com/apps/macos/generic/NordVPN/latest/NordVPN.pkg',
  '1Password': 'https://downloads.1password.com/mac/1Password.pkg',
  'Word': 'https://go.microsoft.com/fwlink/?linkid=525134',
  'Excel': 'https://go.microsoft.com/fwlink/?linkid=525135',
  'PowerPoint': 'https://go.microsoft.com/fwlink/?linkid=525136',
  'Outlook': 'https://go.microsoft.com/fwlink/?linkid=525137',
  'OneNote': 'https://go.microsoft.com/fwlink/?linkid=820886',
  'OneDrive': 'https://go.microsoft.com/fwlink/?linkid=823060',
  'Microsoft Teams': TEAMS_PKG,
  'Teams': TEAMS_PKG,
  'Visual Studio Code': VSCODE_ZIP,
  'VS Code': VSCODE_ZIP,
  'iTerm': 'https://iterm2.com/downloads/stable/latest',
  'Figma': 'https://desktop.figma.com/mac/Figma.zip',
}

// Known-good Windows installers (URL + silent args). .msi needs no args (installs
// machine-wide); .exe args are the installer's silent flag and may need per-app
// tweaking. All URLs verified to resolve to a real .exe/.msi.
const CHROME_MSI = 'https://dl.google.com/dl/chrome/install/googlechromestandaloneenterprise64.msi'
const VSCODE_WIN = { url: 'https://update.code.visualstudio.com/latest/win32-x64-user/stable', args: '/VERYSILENT /NORESTART /MERGETASKS=!runcode' }
const KNOWN_WINDOWS_INSTALLERS: Record<string, { url: string; args: string }> = {
  'Discord': { url: 'https://discord.com/api/download?platform=win', args: '--silent' },
  'Notion': { url: 'https://www.notion.so/desktop/windows/download', args: '/S' },
  'Chrome': { url: CHROME_MSI, args: '' },
  'Google Chrome': { url: CHROME_MSI, args: '' },
  'Firefox': { url: 'https://download.mozilla.org/?product=firefox-latest-ssl&os=win64&lang=en-US', args: '/S' },
  'Zoom': { url: 'https://zoom.us/client/latest/ZoomInstallerFull.msi', args: '' },
  'Slack': { url: 'https://slack.com/ssb/download-win64', args: '-s' },
  'Telegram': { url: 'https://telegram.org/dl/desktop/win64', args: '/VERYSILENT' },
  'Visual Studio Code': VSCODE_WIN,
  'VS Code': VSCODE_WIN,
  '1Password': { url: 'https://downloads.1password.com/win/1PasswordSetup-latest.exe', args: '--silent' },
  'Steam': { url: 'https://cdn.cloudflare.steamstatic.com/client/installer/SteamSetup.exe', args: '/S' },
  'NordVPN': { url: 'https://downloads.nordcdn.com/apps/windows/NordVPN/latest/NordVPNSetup.exe', args: '/S' },
}

export default function EditAppPage() {
  const { id } = useParams()
  const [form, setForm] = useState({ name: '', description: '', url: '', icon: '', status: 'allowed', category: '', process_name: '', mac_app_path: '', windows_uninstall: '', linux_package: '', mac_install_url: '', mac_install_sha256: '', windows_install_url: '', windows_install_sha256: '', windows_install_args: '' })
  const [iconUrl, setIconUrl] = useState<string | null>(null)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [autoIconUrl, setAutoIconUrl] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [allowElevation, setAllowElevation] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('apps').select('*').eq('id', id).single()
      if (data) {
        setForm({ name: data.name, description: data.description, url: data.url, icon: data.icon, status: data.status, category: data.category ?? '', process_name: data.process_name ?? '', mac_app_path: data.mac_app_path ?? '', windows_uninstall: data.windows_uninstall ?? '', linux_package: data.linux_package ?? '', mac_install_url: data.mac_install_url ?? KNOWN_MAC_INSTALLERS[data.name] ?? '', mac_install_sha256: data.mac_install_sha256 ?? '', windows_install_url: data.windows_install_url ?? KNOWN_WINDOWS_INSTALLERS[data.name]?.url ?? '', windows_install_sha256: data.windows_install_sha256 ?? '', windows_install_args: data.windows_install_args ?? KNOWN_WINDOWS_INSTALLERS[data.name]?.args ?? '' })
        setAllowElevation(!!data.allow_elevation)
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
      if (!updated.mac_install_url && KNOWN_MAC_INSTALLERS[value]) updated.mac_install_url = KNOWN_MAC_INSTALLERS[value]
      if (!updated.windows_install_url && KNOWN_WINDOWS_INSTALLERS[value]) {
        updated.windows_install_url = KNOWN_WINDOWS_INSTALLERS[value].url
        updated.windows_install_args = KNOWN_WINDOWS_INSTALLERS[value].args
      }
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
    setForm({ ...form, name, process_name: KNOWN_APPS[name],
      mac_install_url: form.mac_install_url || KNOWN_MAC_INSTALLERS[name] || '',
      windows_install_url: form.windows_install_url || KNOWN_WINDOWS_INSTALLERS[name]?.url || '',
      windows_install_args: form.windows_install_args || KNOWN_WINDOWS_INSTALLERS[name]?.args || '' })
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

    // Store blank overrides as null so the agent falls back to its heuristics.
    const overrides = {
      mac_app_path: form.mac_app_path.trim() || null,
      windows_uninstall: form.windows_uninstall.trim() || null,
      linux_package: form.linux_package.trim() || null,
      mac_install_url: form.mac_install_url.trim() || null,
      mac_install_sha256: form.mac_install_sha256.trim() || null,
      windows_install_url: form.windows_install_url.trim() || null,
      windows_install_sha256: form.windows_install_sha256.trim() || null,
      windows_install_args: form.windows_install_args.trim() || null,
      allow_elevation: allowElevation,
    }
    const { error } = await supabase.from('apps').update({ ...form, ...overrides, icon_url }).eq('id', id)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/admin'
    }
  }

  if (fetching) return <div className="flex items-center justify-center p-20 text-gray-500">Loading...</div>

  const isKnown = !!KNOWN_APPS[form.name] || KNOWN_APPS[form.name] === ''
  const isCustom = form.name.length > 0 && !isKnown && suggestions.length === 0
  const inputClass = "w-full border border-gray-700 rounded-lg px-3 py-2 text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="p-6 max-w-lg mx-auto">
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
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <input type="checkbox" checked={allowElevation} onChange={e => setAllowElevation(e.target.checked)} className="accent-blue-600" />
              Allow elevated run
            </label>
            <p className="text-xs text-gray-500 mt-1">Lets staff launch this app with elevated privileges on a device (via the device page) without granting the user local admin.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
              <option value="allowed">Allowed</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
            <input name="category" value={form.category} onChange={handleChange} list="app-categories"
              placeholder="e.g. Communication, Design, Dev" className={inputClass} />
            <datalist id="app-categories">
              <option value="Communication" /><option value="Design" /><option value="Dev" />
              <option value="Productivity" /><option value="Security" /><option value="Finance" />
            </datalist>
            <p className="text-xs text-gray-600 mt-1">Groups the app in the user portal&apos;s Browse &amp; request chips. Blank = Other.</p>
          </div>

          <details className="rounded-lg border border-gray-800 bg-gray-800/40 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-300 select-none">Install source (optional)</summary>
            <p className="text-xs text-gray-500 mt-2 mb-3">
              For remote install. Required for the &ldquo;Install&rdquo; action to work on that OS. A
              SHA-256, when set, is verified before the installer runs (a mismatch aborts).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">macOS installer URL (.pkg or .dmg)</label>
                <input name="mac_install_url" value={form.mac_install_url} onChange={handleChange}
                  placeholder="https://example.com/App.pkg or .dmg" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">macOS SHA-256 (optional)</label>
                <input name="mac_install_sha256" value={form.mac_install_sha256} onChange={handleChange}
                  placeholder="e3b0c442… (shasum -a 256 App.pkg)" className={`${inputClass} font-mono text-xs`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Windows installer URL (.msi)</label>
                <input name="windows_install_url" value={form.windows_install_url} onChange={handleChange}
                  placeholder="https://example.com/App.msi" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Windows install args (.exe only)</label>
                <input name="windows_install_args" value={form.windows_install_args} onChange={handleChange}
                  placeholder="/S (NSIS/Squirrel) · /VERYSILENT (Inno) · -s (Discord)" className={inputClass} />
                <p className="text-xs text-gray-600 mt-1">Silent-install flags for an .exe installer (.msi ignores this). Blank defaults to /S.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Windows SHA-256 (optional)</label>
                <input name="windows_install_sha256" value={form.windows_install_sha256} onChange={handleChange}
                  placeholder="e3b0c442… (Get-FileHash App.msi)" className={`${inputClass} font-mono text-xs`} />
              </div>
            </div>
          </details>

          <details className="rounded-lg border border-gray-800 bg-gray-800/40 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-300 select-none">Uninstall overrides (optional)</summary>
            <p className="text-xs text-gray-500 mt-2 mb-3">
              For remote uninstall. Leave blank to use the agent&apos;s heuristics
              (macOS: <code className="text-gray-400">/Applications/{form.name || 'AppName'}.app</code>;
              Windows/Linux: match by name). Set an override only when the heuristic misses.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">macOS app path</label>
                <input name="mac_app_path" value={form.mac_app_path} onChange={handleChange}
                  placeholder="/Applications/Discord.app" className={inputClass} />
                <p className="text-xs text-gray-600 mt-1">Full path to the .app bundle (must be directly under /Applications).</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Windows uninstall name</label>
                <input name="windows_uninstall" value={form.windows_uninstall} onChange={handleChange}
                  placeholder="Discord" className={inputClass} />
                <p className="text-xs text-gray-600 mt-1">winget package id, or the Add/Remove Programs display name.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Linux package</label>
                <input name="linux_package" value={form.linux_package} onChange={handleChange}
                  placeholder="discord" className={inputClass} />
                <p className="text-xs text-gray-600 mt-1">Package name for apt / dnf / snap / flatpak.</p>
              </div>
            </div>
          </details>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
    </div>
  )
}
