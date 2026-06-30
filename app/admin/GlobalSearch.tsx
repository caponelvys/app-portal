'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Result = { type: 'org' | 'location' | 'device'; id: string; label: string; url: string }

const TYPE_LABEL: Record<Result['type'], string> = { org: 'Org', location: 'Location', device: 'Device' }

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!q || q.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setSelected(0)
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setOpen(false); setQ('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function navigate(url: string) {
    setOpen(false); setQ(''); setResults([])
    router.push(url)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate(results[selected].url)
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline text-xs text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={() => { setOpen(false); setQ('') }}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
              <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search orgs, locations, devices..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
              />
              <button onClick={() => { setOpen(false); setQ('') }} className="text-gray-600 hover:text-gray-400 text-xs">ESC</button>
            </div>

            {results.length > 0 && (
              <ul className="py-2 max-h-72 overflow-y-auto">
                {results.map((r, i) => (
                  <li key={r.id}>
                    <button
                      onClick={() => navigate(r.url)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-800 transition-colors ${i === selected ? 'bg-gray-800' : ''}`}
                    >
                      <span className="text-xs text-gray-500 w-16 shrink-0">{TYPE_LABEL[r.type]}</span>
                      <span className="text-white text-sm">{r.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {q.length >= 2 && results.length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-500">No results found.</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
