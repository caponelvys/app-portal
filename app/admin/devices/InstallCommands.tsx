'use client'

import { useState } from 'react'

const commands = [
  {
    label: 'Mac Terminal',
    command: 'curl -fsSL https://appcontroller.vercel.app/downloads/install_mac.sh -o install_mac.sh && sudo bash install_mac.sh',
  },
  {
    label: 'Windows PowerShell',
    command: 'Invoke-WebRequest -Uri "https://appcontroller.vercel.app/downloads/install_win.bat" -OutFile "install_win.bat"; Start-Process "install_win.bat" -Verb RunAs',
  },
  {
    label: 'Windows CMD',
    command: 'curl -o install_win.bat https://appcontroller.vercel.app/downloads/install_win.bat && install_win.bat',
  },
]

export default function InstallCommands() {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(label: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-3">
      {commands.map(({ label, command }) => (
        <div key={label}>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
            <code className="flex-1 text-xs text-green-400 font-mono break-all">{command}</code>
            <button
              onClick={() => copy(label, command)}
              className="shrink-0 text-xs text-gray-400 hover:text-white border border-gray-600 rounded px-2 py-1 hover:border-gray-400 transition-colors"
            >
              {copied === label ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
