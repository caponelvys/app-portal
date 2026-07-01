'use client'

import { useState } from 'react'
import { AGENT_VERSION } from '@/lib/agentVersion'

const BASE = 'https://appcontroller.vercel.app/downloads'

const installCommands: Record<string, string> = {
  'Mac Terminal':            `curl -fsSL ${BASE}/install_mac.sh | sudo bash`,
  'Linux Terminal':          `curl -fsSL ${BASE}/install_linux.sh | sudo bash`,
  'Windows PowerShell (64-bit)': `Invoke-WebRequest -Uri "${BASE}/install_win.bat" -OutFile "$env:TEMP\\install_win.bat"; Start-Process "$env:TEMP\\install_win.bat" -Verb RunAs -Wait`,
  'Windows PowerShell (32-bit)': `Invoke-WebRequest -Uri "${BASE}/install_win.bat" -OutFile "$env:TEMP\\install_win.bat"; & "$env:windir\\SysWOW64\\cmd.exe" /c "$env:TEMP\\install_win.bat"`,
  'Windows CMD (64-bit)':   `curl -fsSL ${BASE}/install_win.bat -o "%TEMP%\\install_win.bat" && "%TEMP%\\install_win.bat"`,
  'Windows CMD (32-bit)':   `curl -fsSL ${BASE}/install_win.bat -o "%TEMP%\\install_win.bat" && %windir%\\SysWOW64\\cmd.exe /c "%TEMP%\\install_win.bat"`,
}

const updateCommands: Record<string, string> = {
  'Mac Terminal':   `sudo curl -fsSL ${BASE}/agent.py -o /usr/local/appcontroller/agent.py && sudo launchctl kickstart -k system/com.appcontroller.agent`,
  'Linux Terminal': `sudo curl -fsSL ${BASE}/agent.py -o /usr/local/appcontroller/agent.py && sudo systemctl restart appcontroller`,
  'Windows CMD':    `curl -fsSL ${BASE}/agent.py -o "C:\\AppController\\agent.py" && schtasks /end /tn "AppControllerAgent" && schtasks /run /tn "AppControllerAgent"`,
}

// Direct installer downloads per OS.
const INSTALLERS = [
  { os: 'Windows', file: 'install_win.bat'  },
  { os: 'macOS',   file: 'install_mac.sh'   },
  { os: 'Linux',   file: 'install_linux.sh' },
]

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 2v8m0 0L5 7m3 3l3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 11.5v1a1 1 0 001 1h9a1 1 0 001-1v-1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Tab = 'install' | 'update'

export default function InstallCommands() {
  const [tab, setTab]       = useState<Tab>('install')
  const [selected, setSelected] = useState('Mac Terminal')
  const [copied, setCopied] = useState(false)

  const commands = tab === 'install' ? installCommands : updateCommands
  // Fall back to first option if current selection isn't in update commands
  const activeKey = commands[selected] ? selected : Object.keys(commands)[0]

  function copy() {
    navigator.clipboard.writeText(commands[activeKey])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(['install', 'update'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setCopied(false) }}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'update' ? `Update to v${AGENT_VERSION}` : 'Install'}
          </button>
        ))}
      </div>

      {tab === 'update' && (
        <p className="text-xs text-gray-500">
          Run on each device to update an existing agent to v{AGENT_VERSION}. The agent restarts automatically.
        </p>
      )}

      {/* One-click downloads */}
      {tab === 'install' ? (
        <div>
          <p className="text-xs text-gray-400 mb-2">Download installer</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {INSTALLERS.map(({ os: label, file }) => (
              <a key={label} href={`/downloads/${file}`} download
                className="flex items-center justify-center gap-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-700 hover:border-gray-500 transition-colors">
                <DownloadIcon />
                {label}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-400 mb-2">Download agent</p>
          <a href="/downloads/agent.py" download
            className="inline-flex items-center gap-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-700 hover:border-gray-500 transition-colors">
            <DownloadIcon />
            agent.py (v{AGENT_VERSION})
          </a>
        </div>
      )}

      <p className="text-xs text-gray-500">Or run this command:</p>
      <select
        value={activeKey}
        onChange={e => { setSelected(e.target.value); setCopied(false) }}
        className="w-full sm:w-auto border border-gray-700 rounded-lg px-3 py-2 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {Object.keys(commands).map(label => (
          <option key={label} value={label}>{label}</option>
        ))}
      </select>

      <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
        <code className="flex-1 text-xs text-green-400 font-mono break-all">{commands[activeKey]}</code>
        <button
          onClick={copy}
          className="shrink-0 text-xs text-gray-400 hover:text-white border border-gray-600 rounded px-2 py-1 hover:border-gray-400 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
