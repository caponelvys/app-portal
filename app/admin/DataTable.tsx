'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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

export type FilterDef<T> =
  | { type: 'text';       value: (row: T) => string; }
  | { type: 'select';     value: (row: T) => string; options?: { label: string; value: string }[] }
  | { type: 'time-range'; value: (row: T) => string; }

export type ColDef<T> = {
  id: string
  label: string
  defaultWidth?: number
  sortable?: boolean
  sortValue?: (row: T) => string | number
  filter?: FilterDef<T>
  renderCell: (row: T) => React.ReactNode
  headerExtra?: React.ReactNode
  // Pins the column to the right edge (always visible) and excludes it from
  // drag-reordering. Use for a trailing actions column.
  sticky?: boolean
}

type SortDir = 'asc' | 'desc' | null

const TIME_RANGE_OPTIONS = [
  { label: 'Any time',       value: 'any' },
  { label: 'Last 5 minutes', value: '5m' },
  { label: 'Last hour',      value: '1h' },
  { label: 'Last 24 hours',  value: '24h' },
  { label: 'Last 7 days',    value: '7d' },
  { label: 'Last 30 days',   value: '30d' },
]

function timeRangeCutoff(v: string): number | null {
  const map: Record<string, number> = { '5m': 5*60e3, '1h': 3600e3, '24h': 86400e3, '7d': 7*86400e3, '30d': 30*86400e3 }
  return map[v] ?? null
}

function filterDefault(type: string) {
  if (type === 'text') return ''
  if (type === 'select') return 'all'
  return 'any'
}

function isActive(type: string, val: string) {
  if (type === 'text') return val.length > 0
  if (type === 'select') return val !== 'all'
  return val !== 'any'
}

const inputClass  = 'w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500'
const selectClass = 'w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500'

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${active ? 'text-blue-400' : 'text-gray-600 group-hover/fi:text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 5h16v2H2zM5 9h10v2H5zM8 13h4v2H8z" />
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

function ColumnFilter({ active, onClear, children }: { active: boolean; onClear: () => void; children: React.ReactNode }) {
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
    <span className="inline-block group/fi">
      <button ref={btnRef} onClick={toggle} className="ml-1 p-1.5 rounded hover:bg-gray-700 transition-colors align-middle min-w-[32px] min-h-[32px] flex items-center justify-center">
        <FilterIcon active={active} />
      </button>
      {open && (
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 min-w-[200px]"
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
  col,
  width,
  sortDir,
  onSort,
  onResizeStart,
  filterContent,
  filterActive,
  onClearFilter,
}: {
  col: ColDef<unknown>
  width: number
  sortDir: SortDir
  onSort: () => void
  onResizeStart: (e: React.MouseEvent) => void
  filterContent?: React.ReactNode
  filterActive?: boolean
  onClearFilter?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id })
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
          className="cursor-grab active:cursor-grabbing mr-1 opacity-100 sm:opacity-0 sm:group-hover/hd:opacity-100 transition-opacity touch-none"
          title="Drag to reorder"
        >
          <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 4a1 1 0 100-2 1 1 0 000 2zM13 4a1 1 0 100-2 1 1 0 000 2zM7 8a1 1 0 100-2 1 1 0 000 2zM13 8a1 1 0 100-2 1 1 0 000 2zM7 12a1 1 0 100-2 1 1 0 000 2zM13 12a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
        </span>
        {col.sortable !== false ? (
          <button onClick={onSort} className="flex items-center gap-0.5 hover:text-white transition-colors">
            {col.label}
            <SortIcon dir={sortDir} />
          </button>
        ) : (
          <span>{col.label}</span>
        )}
        {filterContent && (
          <ColumnFilter active={!!filterActive} onClear={onClearFilter ?? (() => {})}>
            {filterContent}
          </ColumnFilter>
        )}
        {col.headerExtra}
      </div>
      <div
        onMouseDown={onResizeStart}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/50 transition-colors group-hover/hd:bg-gray-700/50 hidden sm:block"
      />
    </th>
  )
}

export default function DataTable<T>({
  storageId,
  userId,
  columns,
  rows,
  emptyMessage = 'No data.',
  rowKey,
}: {
  storageId: string
  userId?: string
  columns: ColDef<T>[]
  rows: T[]
  emptyMessage?: string
  rowKey?: (row: T) => string
}) {
  // Sticky columns are pinned right and not drag-reorderable, so the draggable
  // order is built from the non-sticky columns only.
  const defaultIds = columns.filter(c => !c.sticky).map(c => c.id)
  const defaultWidths = Object.fromEntries(columns.map(c => [c.id, c.defaultWidth ?? 160]))

  const [colOrder, setColOrder] = useState<string[]>(defaultIds)
  const [widths, setWidths]     = useState<Record<string, number>>(defaultWidths)
  const [sortCol, setSortCol]   = useState<string | null>(null)
  const [sortDir, setSortDir]   = useState<SortDir>(null)
  const [filters, setFilters]   = useState<Record<string, string>>({})
  const resizingRef = useRef<{ id: string; startX: number; startW: number } | null>(null)

  const key = (suffix: string) => `dt-${suffix}:${storageId}:${userId ?? 'anon'}`

  useEffect(() => {
    try {
      const o = localStorage.getItem(key('order'))
      if (o) { const p: string[] = JSON.parse(o); if (p.every(id => defaultIds.includes(id))) setColOrder(p) }
    } catch {}
    try {
      const w = localStorage.getItem(key('widths'))
      if (w) setWidths(prev => ({ ...prev, ...JSON.parse(w) }))
    } catch {}

    function onMove(e: MouseEvent) {
      if (!resizingRef.current) return
      const { id, startX, startW } = resizingRef.current
      setWidths(prev => ({ ...prev, [id]: Math.max(60, startW + e.clientX - startX) }))
    }
    function onUp() {
      if (!resizingRef.current) return
      setWidths(prev => {
        try { localStorage.setItem(key('widths'), JSON.stringify(prev)) } catch {}
        return prev
      })
      resizingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageId])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    setColOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string))
      try { localStorage.setItem(key('order'), JSON.stringify(next)) } catch {}
      return next
    })
  }

  function startResize(id: string, e: React.MouseEvent) {
    e.preventDefault()
    resizingRef.current = { id, startX: e.clientX, startW: widths[id] ?? 160 }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function toggleSort(id: string) {
    if (sortCol !== id) { setSortCol(id); setSortDir('asc'); return }
    if (sortDir === 'asc') { setSortDir('desc'); return }
    setSortCol(null); setSortDir(null)
  }

  function setFilter(id: string, val: string) {
    setFilters(prev => ({ ...prev, [id]: val }))
  }

  function clearFilter(id: string, type: string) {
    setFilters(prev => ({ ...prev, [id]: filterDefault(type) }))
  }

  const colMap = Object.fromEntries(columns.map(c => [c.id, c]))
  const normalCols = columns.filter(c => !c.sticky)
  const orderedNormal = colOrder.map(id => colMap[id]).filter((c): c is ColDef<T> => !!c && !c.sticky)
  const missing = normalCols.filter(c => !colOrder.includes(c.id))
  const orderedCols = [...orderedNormal, ...missing]
  const stickyCols = columns.filter(c => c.sticky)

  const dynamicOptions = useMemo(() => {
    const result: Record<string, { label: string; value: string }[]> = {}
    for (const col of columns) {
      if (col.filter?.type === 'select' && !col.filter.options) {
        const vals = Array.from(new Set(rows.map(r => (col.filter as { type: 'select'; value: (r: T) => string }).value(r)))).filter(Boolean).sort()
        result[col.id] = vals.map(v => ({ label: v, value: v }))
      }
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter(row => {
      for (const col of columns) {
        if (!col.filter) continue
        const fv = filters[col.id] ?? filterDefault(col.filter.type)
        const rv = col.filter.value(row)
        if (col.filter.type === 'text') {
          if (fv && !rv.toLowerCase().includes(fv.toLowerCase())) return false
        } else if (col.filter.type === 'select') {
          if (fv !== 'all' && rv !== fv) return false
        } else if (col.filter.type === 'time-range') {
          if (fv !== 'any') {
            const cutoff = timeRangeCutoff(fv)
            if (cutoff && (!rv || Date.now() - new Date(rv).getTime() > cutoff)) return false
          }
        }
      }
      return true
    })
  }, [rows, filters, columns])

  const sorted = sortCol && sortDir
    ? [...filtered].sort((a, b) => {
        const col = colMap[sortCol]
        if (!col?.sortValue) return 0
        const av = col.sortValue(a), bv = col.sortValue(b)
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    : filtered

  function buildFilterContent(col: ColDef<T>): React.ReactNode | undefined {
    if (!col.filter) return undefined
    const fv = filters[col.id] ?? filterDefault(col.filter.type)
    const setF = (v: string) => setFilter(col.id, v)

    if (col.filter.type === 'text') {
      return (
        <input
          autoFocus
          type="text"
          placeholder={`Search ${col.label.toLowerCase()}…`}
          value={fv}
          onChange={e => setF(e.target.value)}
          className={inputClass}
        />
      )
    }
    if (col.filter.type === 'select') {
      const opts = col.filter.options ?? dynamicOptions[col.id] ?? []
      return (
        <select value={fv} onChange={e => setF(e.target.value)} className={selectClass}>
          <option value="all">All {col.label}</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    if (col.filter.type === 'time-range') {
      return (
        <select value={fv} onChange={e => setF(e.target.value)} className={selectClass}>
          {TIME_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
  }

  const anyFilter = columns.some(col => col.filter && isActive(col.filter.type, filters[col.id] ?? filterDefault(col.filter.type)))

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToHorizontalAxis]} onDragEnd={handleDragEnd}>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700 group/hd">
              <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                <tr>
                  {orderedCols.map(col => (
                    <SortableHeader
                      key={col.id}
                      col={col as ColDef<unknown>}
                      width={widths[col.id] ?? 160}
                      sortDir={sortCol === col.id ? sortDir : null}
                      onSort={() => toggleSort(col.id)}
                      onResizeStart={e => startResize(col.id, e)}
                      filterContent={buildFilterContent(col)}
                      filterActive={col.filter ? isActive(col.filter.type, filters[col.id] ?? filterDefault(col.filter.type)) : false}
                      onClearFilter={() => col.filter && clearFilter(col.id, col.filter.type)}
                    />
                  ))}
                  {stickyCols.map(col => (
                    <th key={col.id} style={{ width: widths[col.id] ?? 56, minWidth: widths[col.id] ?? 56 }}
                      className="px-2 py-3 text-left font-medium text-gray-400 sticky right-0 bg-gray-800 border-l border-gray-700">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </SortableContext>
            </thead>
            <tbody>
              {sorted.length > 0 ? sorted.map((row, i) => (
                <tr key={rowKey ? rowKey(row) : i} className="border-b border-gray-800 hover:bg-gray-800">
                  {orderedCols.map(col => (
                    <td key={col.id} className="px-4 py-3">
                      {col.renderCell(row)}
                    </td>
                  ))}
                  {stickyCols.map(col => (
                    <td key={col.id} className="px-2 py-3 sticky right-0 bg-gray-900 border-l border-gray-800">
                      {col.renderCell(row)}
                    </td>
                  ))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={orderedCols.length + stickyCols.length} className="px-4 py-10 text-center text-gray-500">
                    {anyFilter ? 'No rows match the active filters.' : emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DndContext>
      {anyFilter && (
        <p className="mt-1.5 text-xs text-gray-500">
          Showing {sorted.length} of {rows.length} rows ·{' '}
          <button
            className="text-blue-400 hover:text-blue-300"
            onClick={() => setFilters({})}
          >
            Clear all filters
          </button>
        </p>
      )}
    </div>
  )
}
