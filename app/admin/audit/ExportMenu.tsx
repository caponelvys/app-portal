'use client'

import { useState, useRef, useEffect } from 'react'

type Org = { id: string; name: string }

export default function ExportMenu({ orgs }: { orgs: Org[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm bg-gray-800 border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
      >
        Export
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
          <p className="px-3 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wide">Global</p>
          <a
            href="/api/audit/export"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <FileIcon /> All Orgs — CSV
          </a>
          <a
            href="/admin/audit/print"
            target="_blank"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <PrintIcon /> All Orgs — PDF
          </a>

          {orgs.length > 0 && (
            <>
              <div className="border-t border-gray-800 my-1" />
              <p className="px-3 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wide">By Client</p>
              {orgs.map(org => (
                <a
                  key={org.id}
                  href={`/admin/audit/print?org_id=${org.id}&org_name=${encodeURIComponent(org.name)}`}
                  target="_blank"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors truncate"
                >
                  <PrintIcon /> {org.name}
                </a>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FileIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}
