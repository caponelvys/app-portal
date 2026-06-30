'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Device = {
  id: string
  device_id: string
  hostname: string
  os: string
  last_seen: string
}

type ColId = 'hostname' | 'os' | 'status' | 'lastSeen'
type SortDir = 'asc' | 'desc' | null

const DEFAULT_COLS: ColId[] = ['hostname', 'os', 'status', 'lastSeen']
const DEFAULT_WIDTHS: Record<ColId, number> = { hostname: 220, os: 140, status: 120, lastSeen: 180 }
const widthKey = (uid: string) => `devices-col-widths:${uid}`
const COL_LABELS: Record<ColId, string> = {
  hostname: 'Hostname',
  os: 'OS',
  status: 'Status',
  lastSeen: 'Last Seen',
}
const orderKey = (uid: string) => `devices-col-order:${uid}`

function osLabel(os: string) {
  if (os === 'Darwin') return 'macOS'
  if (os === 'Windows') return 'Windows'
  return os
}

function isOnline(lastSeen: string) {
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000
}

const LAST_SEEN_OPTIONS = [
  { label: 'Any time',       value: 'any' },
  { label: 'Last 5 minutes', value: '5m' },
  { label: 'Last hour',      value: '1h' },
  { label: 'Last 24 hours',  value: '24h' },
  { label: 'Last 7 days',    value: '7d' },
]

function lastSeenCutoff(value: string): number | null {
  const map: Record<string, number> = { '5m': 5*60e3, '1h': 3600e3, '24h': 86400e3, '7d': 604800e3 }
  return map[value] ?? null
}

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${active ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L13 9.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-7.586L3.293 5.707A1 1 0 013 5V3z" clipRule="evenodd" />
    </svg>
  )
}

function SortIcon({ dir }: { dir: SortDir }) {
  return (
    <svg className={`w-3 h-3 ml-0.5 inline ${dir ? 'text-blue-400' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
      {dir === 'asc'
        ? <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        : dir === 'desc'
        ? <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        : <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />}
    </svg>
  )
}

function ColumnFilter({ children, onClear, active }: { children: React.ReactNode; onClear: () => void; active: boolean }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        popRef.current && !popRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(o => !o)
  }

  return (
    <span className="inline-block">
      <button ref={btnRef} onClick={toggle} className="group ml-1.5 p-0.5 rounded hover:bg-gray-700 transition-colors align-middle">
        <FilterIcon active={active} />
      </button>
      {open && (
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 min-w-[180px]"
        >
          {children}
          {active && (
            <button onClick={() => { onClear(); setOpen(false) }} className="mt-2 w-full text-xs text-gray-400 hover:text-white text-left">
              Clear filter
            </button>
          )}
        </div>
      )}
    </span>
  )
}

function SortableHeader({
  id,
  width,
  children,
  sortDir,
  onSort,
  onResizeStart,
}: {
  id: ColId
  width: number
  children: React.ReactNode
  sortDir: SortDir
  onSort: () => void
  onResizeStart: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, width, minWidth: width }}
      className="relative text-left px-4 py-3 font-medium text-gray-400 whitespace-nowrap select-none"
    >
      <div className="flex items-center gap-1">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mr-1 opacity-0 group-hover/header:opacity-100 transition-opacity"
          title="Drag to reorder column"
        >
          <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 4a1 1 0 100-2 1 1 0 000 2zM13 4a1 1 0 100-2 1 1 0 000 2zM7 8a1 1 0 100-2 1 1 0 000 2zM13 8a1 1 0 100-2 1 1 0 000 2zM7 12a1 1 0 100-2 1 1 0 000 2zM13 12a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
        </span>
        <button onClick={onSort} className="flex items-center gap-0.5 hover:text-white transition-colors">
          {children}
          <SortIcon dir={sortDir} />
        </button>
      </div>
      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/50 transition-colors group-hover/header:bg-gray-700/50"
        title="Drag to resize column"
      />
    </th>
  )
}

export default function DevicesTabs({ devices, userId = 'anon' }: { devices: Device[]; userId?: string }) {
  const [cols, setCols] = useState<ColId[]>(DEFAULT_COLS)
  const [widths, setWidths] = useState<Record<ColId, number>>(DEFAULT_WIDTHS)
  const resizingRef = useRef<{ col: ColId; startX: number; startW: number } | null>(null)
  const [hostnameFilter, setHostnameFilter] = useState('')
  const [osFilter, setOsFilter]             = useState('all')
  const [statusFilter, setStatusFilter]     = useState('all')
  const [lastSeenFilter, setLastSeenFilter] = useState('any')
  const [sortCol, setSortCol]               = useState<ColId | null>(null)
  const [sortDir, setSortDir]               = useState<SortDir>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(orderKey(userId))
      if (saved) {
        const parsed: ColId[] = JSON.parse(saved)
        if (parsed.every(c => DEFAULT_COLS.includes(c))) setCols(parsed)
      }
    } catch {}
    try {
      const saved = localStorage.getItem(widthKey(userId))
      if (saved) setWidths({ ...DEFAULT_WIDTHS, ...JSON.parse(saved) })
    } catch {}

    function onMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return
      const { col, startX, startW } = resizingRef.current
      const next = Math.max(80, startW + (e.clientX - startX))
      setWidths(prev => ({ ...prev, [col]: next }))
    }
    function onMouseUp() {
      if (!resizingRef.current) return
      setWidths(prev => {
        try { localStorage.setItem(widthKey(userId), JSON.stringify(prev)) } catch {}
        return prev
      })
      resizingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    setCols(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id as ColId), prev.indexOf(over.id as ColId))
      try { localStorage.setItem(orderKey(userId), JSON.stringify(next)) } catch {}
      return next
    })
  }

  function startResize(col: ColId, e: React.MouseEvent) {
    e.preventDefault()
    resizingRef.current = { col, startX: e.clientX, startW: widths[col] }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function toggleSort(col: ColId) {
    if (sortCol !== col) { setSortCol(col); setSortDir('asc'); return }
    if (sortDir === 'asc') { setSortDir('desc'); return }
    setSortCol(null); setSortDir(null)
  }

  const osOptions = useMemo(() => Array.from(new Set(devices.map(d => osLabel(d.os)))).sort(), [devices])

  const filtered = useMemo(() => {
    const cutoff = lastSeenCutoff(lastSeenFilter)
    const now = Date.now()
    let list = devices.filter(d => {
      if (hostnameFilter && !d.hostname.toLowerCase().includes(hostnameFilter.toLowerCase())) return false
      if (osFilter !== 'all' && osLabel(d.os) !== osFilter) return false
      const online = isOnline(d.last_seen)
      if (statusFilter === 'online' && !online) return false
      if (statusFilter === 'offline' && online) return false
      if (cutoff && now - new Date(d.last_seen).getTime() > cutoff) return false
      return true
    })
    if (sortCol && sortDir) {
      list = [...list].sort((a, b) => {
        let av: string | number, bv: string | number
        if (sortCol === 'hostname') { av = a.hostname; bv = b.hostname }
        else if (sortCol === 'os') { av = osLabel(a.os); bv = osLabel(b.os) }
        else if (sortCol === 'status') { av = isOnline(a.last_seen) ? 0 : 1; bv = isOnline(b.last_seen) ? 0 : 1 }
        else { av = new Date(a.last_seen).getTime(); bv = new Date(b.last_seen).getTime() }
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    }
    return list
  }, [devices, hostnameFilter, osFilter, statusFilter, lastSeenFilter, sortCol, sortDir])

  const inputClass  = "w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
  const selectClass = "w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"

  function renderHeader(col: ColId) {
    const dir = sortCol === col ? sortDir : null
    switch (col) {
      case 'hostname': return (
        <SortableHeader key={col} id={col} width={widths[col]} sortDir={dir} onSort={() => toggleSort(col)} onResizeStart={e => startResize(col, e)}>
          Hostname
          <ColumnFilter active={!!hostnameFilter} onClear={() => setHostnameFilter('')}>
            <input autoFocus type="text" placeholder="Search hostname..." value={hostnameFilter} onChange={e => setHostnameFilter(e.target.value)} className={inputClass} />
          </ColumnFilter>
        </SortableHeader>
      )
      case 'os': return (
        <SortableHeader key={col} id={col} width={widths[col]} sortDir={dir} onSort={() => toggleSort(col)} onResizeStart={e => startResize(col, e)}>
          OS
          <ColumnFilter active={osFilter !== 'all'} onClear={() => setOsFilter('all')}>
            <select value={osFilter} onChange={e => setOsFilter(e.target.value)} className={selectClass}>
              <option value="all">All OS</option>
              {osOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </ColumnFilter>
        </SortableHeader>
      )
      case 'status': return (
        <SortableHeader key={col} id={col} width={widths[col]} sortDir={dir} onSort={() => toggleSort(col)} onResizeStart={e => startResize(col, e)}>
          Status
          <ColumnFilter active={statusFilter !== 'all'} onClear={() => setStatusFilter('all')}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
              <option value="all">All</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </ColumnFilter>
        </SortableHeader>
      )
      case 'lastSeen': return (
        <SortableHeader key={col} id={col} width={widths[col]} sortDir={dir} onSort={() => toggleSort(col)} onResizeStart={e => startResize(col, e)}>
          Last Seen
          <ColumnFilter active={lastSeenFilter !== 'any'} onClear={() => setLastSeenFilter('any')}>
            <select value={lastSeenFilter} onChange={e => setLastSeenFilter(e.target.value)} className={selectClass}>
              {LAST_SEEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </ColumnFilter>
        </SortableHeader>
      )
    }
  }

  function renderCell(col: ColId, device: Device) {
    switch (col) {
      case 'hostname': return (
        <td key={col} className="px-4 py-3 font-medium text-white">
          <a href={`/admin/devices/${device.device_id}`} className="hover:text-blue-400 transition-colors">
            {device.hostname.split('.')[0]}
          </a>
        </td>
      )
      case 'os': return <td key={col} className="px-4 py-3 text-gray-400">{osLabel(device.os)}</td>
      case 'status': return (
        <td key={col} className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${isOnline(device.last_seen) ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline(device.last_seen) ? 'bg-green-400' : 'bg-gray-500'}`} />
            {isOnline(device.last_seen) ? 'Online' : 'Offline'}
          </span>
        </td>
      )
      case 'lastSeen': return <td key={col} className="px-4 py-3 text-gray-500 text-xs">{new Date(device.last_seen).toLocaleString()}</td>
    }
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToHorizontalAxis]} onDragEnd={handleDragEnd}>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-800 border-b border-gray-700 group/header">
              <SortableContext items={cols} strategy={horizontalListSortingStrategy}>
                <tr>{cols.map(col => renderHeader(col))}</tr>
              </SortableContext>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(device => (
                <tr key={device.id} className="border-b border-gray-800 hover:bg-gray-800">
                  {cols.map(col => renderCell(col, device))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={cols.length} className="px-4 py-10 text-center text-gray-500">
                    {devices.length === 0
                      ? 'No devices enrolled yet. Select an organization and use Install Agent to get started.'
                      : 'No devices match the active filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DndContext>
      <p className="text-xs text-gray-600">{filtered.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
