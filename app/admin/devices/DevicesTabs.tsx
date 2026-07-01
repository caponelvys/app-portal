'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getHealthTier, TIER_LABEL, TIER_COLOR, TIER_DOT, HealthTier } from '@/lib/deviceStatus'
import { cleanHostname } from '@/lib/hostname'

type Device = {
  id: string
  device_id: string
  hostname: string
  os: string
  last_seen: string
  agent_version?: string | null
  ip_address?: string | null
  locations?: { name: string } | null
  orgs?: { name: string } | null
}

type ColId = 'hostname' | 'os' | 'status' | 'org' | 'location' | 'agentVersion' | 'ipAddress' | 'lastSeen'
type SortDir = 'asc' | 'desc' | null

const DEFAULT_COLS: ColId[] = ['hostname', 'os', 'status', 'org', 'location', 'agentVersion', 'ipAddress', 'lastSeen']
const DEFAULT_WIDTHS: Record<ColId, number> = {
  hostname: 180, os: 120, status: 130, org: 150, location: 140,
  agentVersion: 130, ipAddress: 130, lastSeen: 160,
}
const COL_LABELS: Record<ColId, string> = {
  hostname: 'Device', os: 'OS', status: 'Status', org: 'Organization',
  location: 'Location', agentVersion: 'Agent Version', ipAddress: 'IP Address', lastSeen: 'Last Seen',
}

const widthKey = (uid: string) => `devices-col-widths:${uid}`
const orderKey = (uid: string) => `devices-col-order:${uid}`

const LAST_SEEN_OPTIONS = [
  { label: 'Any time',       value: 'any' },
  { label: 'Last 5 minutes', value: '5m' },
  { label: 'Last hour',      value: '1h' },
  { label: 'Last 24 hours',  value: '24h' },
  { label: 'Last 7 days',    value: '7d' },
]
function lastSeenCutoff(v: string): number | null {
  const map: Record<string, number> = { '5m': 5*60e3, '1h': 3600e3, '24h': 86400e3, '7d': 604800e3 }
  return map[v] ?? null
}

const STATUS_TIERS: HealthTier[] = ['healthy', 'inactive', 'warning', 'stale', 'lost', 'never']

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${active ? 'text-blue-400' : 'text-gray-600 group-hover/fi:text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
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
      if (popRef.current && !popRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node))
        setOpen(false)
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
    <span className="inline-block group/fi">
      <button ref={btnRef} onClick={toggle} className="ml-1 p-1.5 rounded hover:bg-gray-700 transition-colors align-middle min-w-[32px] min-h-[32px] flex items-center justify-center">
        <FilterIcon active={active} />
      </button>
      {open && (
        <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 min-w-[200px]">
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
  id, width, children, sortDir, onSort, onResizeStart,
}: {
  id: ColId; width: number; children: React.ReactNode; sortDir: SortDir
  onSort: () => void; onResizeStart: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <th ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, width, minWidth: width }}
      className="relative text-left px-4 py-3 font-medium text-gray-400 whitespace-nowrap select-none">
      <div className="flex items-center gap-1">
        <span {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing mr-1 opacity-100 sm:opacity-0 sm:group-hover/header:opacity-100 transition-opacity touch-none">
          <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 4a1 1 0 100-2 1 1 0 000 2zM13 4a1 1 0 100-2 1 1 0 000 2zM7 8a1 1 0 100-2 1 1 0 000 2zM13 8a1 1 0 100-2 1 1 0 000 2zM7 12a1 1 0 100-2 1 1 0 000 2zM13 12a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
        </span>
        <button onClick={onSort} className="flex items-center gap-0.5 hover:text-white transition-colors">
          {COL_LABELS[id]}
          <SortIcon dir={sortDir} />
        </button>
        {children}
      </div>
      <div onMouseDown={onResizeStart}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/50 transition-colors hidden sm:block" />
    </th>
  )
}

const inputClass  = 'w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500'
const selectClass = 'w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function DevicesTabs({ devices, userId = 'anon' }: { devices: Device[]; userId?: string }) {
  const [cols, setCols]   = useState<ColId[]>(DEFAULT_COLS)
  const [widths, setWidths] = useState<Record<ColId, number>>(DEFAULT_WIDTHS)
  const resizingRef = useRef<{ col: ColId; startX: number; startW: number } | null>(null)

  const [hostnameFilter, setHostnameFilter]         = useState('')
  const [osFilter, setOsFilter]                     = useState('all')
  const [statusFilter, setStatusFilter]             = useState('all')
  const [orgFilter, setOrgFilter]                   = useState('all')
  const [locationFilter, setLocationFilter]         = useState('all')
  const [agentVersionFilter, setAgentVersionFilter] = useState('all')
  const [lastSeenFilter, setLastSeenFilter]         = useState('any')

  const [sortCol, setSortCol] = useState<ColId | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

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
      setWidths(prev => ({ ...prev, [col]: Math.max(80, startW + (e.clientX - startX)) }))
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
  }, [userId])

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

  const osOptions          = useMemo(() => Array.from(new Set(devices.map(d => d.os))).filter(Boolean).sort(), [devices])
  const orgOptions         = useMemo(() => Array.from(new Set(devices.map(d => d.orgs?.name ?? '').filter(Boolean))).sort(), [devices])
  const locationOptions    = useMemo(() => Array.from(new Set(devices.map(d => d.locations?.name ?? '').filter(Boolean))).sort(), [devices])
  const agentVersionOptions = useMemo(() => Array.from(new Set(devices.map(d => d.agent_version ?? '').filter(Boolean))).sort(), [devices])

  const filtered = useMemo(() => {
    const cutoff = lastSeenCutoff(lastSeenFilter)
    const now = Date.now()
    let list = devices.filter(d => {
      if (hostnameFilter && !cleanHostname(d.hostname).toLowerCase().includes(hostnameFilter.toLowerCase())) return false
      if (osFilter !== 'all' && d.os !== osFilter) return false
      if (statusFilter !== 'all' && getHealthTier(d.last_seen) !== statusFilter) return false
      if (orgFilter !== 'all' && (d.orgs?.name ?? '') !== orgFilter) return false
      if (locationFilter !== 'all' && (d.locations?.name ?? '') !== locationFilter) return false
      if (agentVersionFilter !== 'all' && (d.agent_version ?? '') !== agentVersionFilter) return false
      if (cutoff && now - new Date(d.last_seen).getTime() > cutoff) return false
      return true
    })
    if (sortCol && sortDir) {
      list = [...list].sort((a, b) => {
        let av: string | number = '', bv: string | number = ''
        if (sortCol === 'hostname')     { av = cleanHostname(a.hostname); bv = cleanHostname(b.hostname) }
        else if (sortCol === 'os')      { av = a.os; bv = b.os }
        else if (sortCol === 'status')  { av = getHealthTier(a.last_seen); bv = getHealthTier(b.last_seen) }
        else if (sortCol === 'org')     { av = a.orgs?.name ?? ''; bv = b.orgs?.name ?? '' }
        else if (sortCol === 'location'){ av = a.locations?.name ?? ''; bv = b.locations?.name ?? '' }
        else if (sortCol === 'agentVersion') { av = a.agent_version ?? ''; bv = b.agent_version ?? '' }
        else if (sortCol === 'ipAddress')    { av = a.ip_address ?? ''; bv = b.ip_address ?? '' }
        else { av = new Date(a.last_seen).getTime(); bv = new Date(b.last_seen).getTime() }
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    }
    return list
  }, [devices, hostnameFilter, osFilter, statusFilter, orgFilter, locationFilter, agentVersionFilter, lastSeenFilter, sortCol, sortDir])

  const anyFilter = hostnameFilter || osFilter !== 'all' || statusFilter !== 'all' || orgFilter !== 'all' || locationFilter !== 'all' || agentVersionFilter !== 'all' || lastSeenFilter !== 'any'

  function renderFilter(col: ColId) {
    switch (col) {
      case 'hostname': return (
        <ColumnFilter active={!!hostnameFilter} onClear={() => setHostnameFilter('')}>
          <input autoFocus type="text" placeholder="Search device…" value={hostnameFilter} onChange={e => setHostnameFilter(e.target.value)} className={inputClass} />
        </ColumnFilter>
      )
      case 'os': return (
        <ColumnFilter active={osFilter !== 'all'} onClear={() => setOsFilter('all')}>
          <select value={osFilter} onChange={e => setOsFilter(e.target.value)} className={selectClass}>
            <option value="all">All OS</option>
            {osOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </ColumnFilter>
      )
      case 'status': return (
        <ColumnFilter active={statusFilter !== 'all'} onClear={() => setStatusFilter('all')}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="all">All statuses</option>
            {STATUS_TIERS.map(t => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
          </select>
        </ColumnFilter>
      )
      case 'org': return orgOptions.length > 0 ? (
        <ColumnFilter active={orgFilter !== 'all'} onClear={() => setOrgFilter('all')}>
          <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className={selectClass}>
            <option value="all">All orgs</option>
            {orgOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </ColumnFilter>
      ) : null
      case 'location': return locationOptions.length > 0 ? (
        <ColumnFilter active={locationFilter !== 'all'} onClear={() => setLocationFilter('all')}>
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className={selectClass}>
            <option value="all">All locations</option>
            {locationOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </ColumnFilter>
      ) : null
      case 'agentVersion': return agentVersionOptions.length > 0 ? (
        <ColumnFilter active={agentVersionFilter !== 'all'} onClear={() => setAgentVersionFilter('all')}>
          <select value={agentVersionFilter} onChange={e => setAgentVersionFilter(e.target.value)} className={selectClass}>
            <option value="all">All versions</option>
            {agentVersionOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </ColumnFilter>
      ) : null
      case 'lastSeen': return (
        <ColumnFilter active={lastSeenFilter !== 'any'} onClear={() => setLastSeenFilter('any')}>
          <select value={lastSeenFilter} onChange={e => setLastSeenFilter(e.target.value)} className={selectClass}>
            {LAST_SEEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </ColumnFilter>
      )
      default: return null
    }
  }

  function renderCell(col: ColId, d: Device) {
    switch (col) {
      case 'hostname': return (
        <td key={col} className="px-4 py-3 font-medium text-white">
          <a href={`/admin/devices/${d.device_id}`} className="hover:text-blue-400 transition-colors">
            {cleanHostname(d.hostname)}
          </a>
        </td>
      )
      case 'os': return <td key={col} className="px-4 py-3 text-gray-400 text-sm">{d.os}</td>
      case 'status': {
        const tier = getHealthTier(d.last_seen)
        return (
          <td key={col} className="px-4 py-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TIER_COLOR[tier]}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${TIER_DOT[tier]}`} />
              {TIER_LABEL[tier]}
            </span>
          </td>
        )
      }
      case 'org': return <td key={col} className="px-4 py-3 text-gray-400 text-sm">{d.orgs?.name ?? <span className="text-gray-600">—</span>}</td>
      case 'location': return <td key={col} className="px-4 py-3 text-gray-400 text-sm">{d.locations?.name ?? <span className="text-gray-600">—</span>}</td>
      case 'agentVersion': return (
        <td key={col} className="px-4 py-3 text-sm">
          {d.agent_version
            ? <span className="text-gray-300 font-mono text-xs">{d.agent_version}</span>
            : <span className="text-gray-600 text-xs">—</span>}
        </td>
      )
      case 'ipAddress': return (
        <td key={col} className="px-4 py-3 text-gray-400 font-mono text-xs">
          {d.ip_address ?? <span className="text-gray-600">—</span>}
        </td>
      )
      case 'lastSeen': return (
        <td key={col} className="px-4 py-3 text-gray-500 text-xs">
          {d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}
        </td>
      )
    }
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToHorizontalAxis]} onDragEnd={handleDragEnd}>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-gray-800 border-b border-gray-700 group/header">
              <SortableContext items={cols} strategy={horizontalListSortingStrategy}>
                <tr>
                  {cols.map(col => (
                    <SortableHeader key={col} id={col} width={widths[col]}
                      sortDir={sortCol === col ? sortDir : null}
                      onSort={() => toggleSort(col)}
                      onResizeStart={e => startResize(col, e)}>
                      {renderFilter(col)}
                    </SortableHeader>
                  ))}
                </tr>
              </SortableContext>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(device => (
                <tr key={device.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  {cols.map(col => renderCell(col, device))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={cols.length} className="px-4 py-10 text-center text-gray-500">
                    {devices.length === 0
                      ? 'No devices enrolled yet.'
                      : anyFilter ? 'No devices match the active filters.' : 'No devices found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DndContext>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{filtered.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}</span>
        {anyFilter && (
          <button className="text-blue-400 hover:text-blue-300"
            onClick={() => { setHostnameFilter(''); setOsFilter('all'); setStatusFilter('all'); setOrgFilter('all'); setLocationFilter('all'); setAgentVersionFilter('all'); setLastSeenFilter('any') }}>
            Clear all filters
          </button>
        )}
      </div>
    </div>
  )
}
