'use client'

import { useState } from 'react'

const commands: Record<string, string> = {
  'Mac Terminal': 'curl -fsSL https://appcontroller.vercel.app/downloads/install_mac.sh -o install_mac.sh && sudo bash install_mac.sh',
  'Linux Terminal': 'curl -fsSL https://appcontroller.vercel.app/downloads/install_linux.sh -o install_linux.sh && sudo bash install_linux.sh',
  'Windows PowerShell (64-bit)': 'Invoke-WebRequest -Uri "https://appcontroller.vercel.app/downloads/install_win.bat" -OutFile "install_win.bat"; Start-Process "install_win.bat" -Verb RunAs',
  'Windows PowerShell (32-bit)': 'Invoke-WebRequest -Uri "https://appcontroller.vercel.app/downloads/install_win.bat" -OutFile "install_win.bat"; & "$env:windir\\SysWOW64\\cmd.exe" /c "install_win.bat"',
  'Windows CMD (64-bit)': 'curl -o install_win.bat https://appcontroller.vercel.app/downloads/install_win.bat && install_win.bat',
  'Windows CMD (32-bit)': 'curl -o install_win.bat https://appcontroller.vercel.app/downloads/install_win.bat && %windir%\\SysWOW64\\cmd.exe /c install_win.bat',
}

export default function InstallCommands() {
  const [selected, setSelected] = useState('Mac Terminal')
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(commands[selected])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <select
        value={selected}
        onChange={e => { setSelected(e.target.value); setCopied(false) }}
        className="w-full sm:w-auto border border-gray-700 rounded-lg px-3 py-2 text-sm text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {Object.keys(commands).map(label => (
          <option key={label} value={label}>{label}</option>
        ))}
      </select>

      <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
        <code className="flex-1 text-xs text-green-400 font-mono break-all">{commands[selected]}</code>
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
