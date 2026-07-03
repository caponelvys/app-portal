'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext, arrayMove, horizontalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TableState, tableHref, TIME_RANGE_OPTIONS } from '@/lib/tableParams'

// Server-driven variant of DataTable: rows are one already-filtered/sorted/paged
// slice from the DB. Sorting, filtering and pagination rewrite the URL (server
// re-queries); column reorder/resize/visibility stay client-side (localStorage).
export type ServerFilterDef =
  | { type: 'text'; placeholder?: string }
  | { type: 'select'; options: { label: string; value: string }[] }
  | { type: 'time-range' }

export type ServerColDef<T> = {
  id: string
  label: string
  defaultWidth?: number
  sortable?: boolean         // false = no sort control (default true)
  filter?: ServerFilterDef
  renderCell: (row: T) => React.ReactNode
  sticky?: boolean           // pinned right, not reorderable (trailing actions)
}

const inputClass  = 'w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500'
const selectClass = inputClass

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${active ? 'text-blue-400' : 'text-gray-600 group-hover/fi:text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L13 9.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-7.586L3.293 5.707A1 1 0 013 5V3z" clipRule="evenodd" />
    </svg>
  )
}

function SortIcon({ dir }: { dir: 'asc' | 'desc' | null }) {
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

function FilterPopover({ active, onClear, children }: { active: boolean; onClear: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
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

// Debounced text filter: types locally, pushes to the URL after a pause so we
// don't fire a server query per keystroke.
function TextFilter({ value, placeholder, onCommit }: { value: string; placeholder?: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  useEffect(() => {
    if (local === value) return
    const t = setTimeout(() => onCommit(local), 350)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])
  return (
    <input autoFocus type="text" placeholder={placeholder ?? 'Search…'} value={local}
      onChange={e => setLocal(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onCommit(local) }}
      className={inputClass} />
  )
}

function SortableHeader({
  col, width, sortDir, onSort, onResizeStart, filterContent, filterActive, onClearFilter,
}: {
  col: ServerColDef<unknown>
  width: number
  sortDir: 'asc' | 'desc' | null
  onSort: () => void
  onResizeStart: (e: React.MouseEvent) => void
  filterContent?: React.ReactNode
  filterActive?: boolean
  onClearFilter?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id })
  return (
    <th ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, width, minWidth: width }}
      className="relative text-left px-4 py-3 font-medium text-gray-400 whitespace-nowrap select-none">
      <div className="flex items-center gap-1">
        <span {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing mr-1 opacity-100 sm:opacity-0 sm:group-hover/hd:opacity-100 transition-opacity touch-none" title="Drag to reorder">
          <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 4a1 1 0 100-2 1 1 0 000 2zM13 4a1 1 0 100-2 1 1 0 000 2zM7 8a1 1 0 100-2 1 1 0 000 2zM13 8a1 1 0 100-2 1 1 0 000 2zM7 12a1 1 0 100-2 1 1 0 000 2zM13 12a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
        </span>
        {col.sortable !== false ? (
          <button onClick={onSort} className="flex items-center gap-0.5 hover:text-white transition-colors">
            {col.label}<SortIcon dir={sortDir} />
          </button>
        ) : <span>{col.label}</span>}
        {filterContent && (
          <FilterPopover active={!!filterActive} onClear={onClearFilter ?? (() => {})}>
            {filterContent}
          </FilterPopover>
        )}
      </div>
      <div onMouseDown={onResizeStart}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/50 transition-colors group-hover/hd:bg-gray-700/50 hidden sm:block" />
    </th>
  )
}

export default function ServerDataTable<T>({
  storageId, userId, basePath, state, columns, rows, total, pageSize, emptyMessage = 'No data.', rowKey,
}: {
  storageId: string
  userId?: string
  basePath: string
  state: TableState
  columns: ServerColDef<T>[]
  rows: T[]
  total: number
  pageSize: number
  emptyMessage?: string
  rowKey?: (row: T) => string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const go = (href: string) => startTransition(() => router.replace(href, { scroll: false }))
  const applyFilter = (colId: string, value: string | null) => go(tableHref(basePath, state, { filters: { [colId]: value } }))
  const applySort = (colId: string) => {
    // asc → desc → cleared, matching the client DataTable.
    if (state.sort !== colId) return go(tableHref(basePath, state, { sort: colId, dir: 'asc' }))
    if (state.dir === 'asc') return go(tableHref(basePath, state, { sort: colId, dir: 'desc' }))
    go(tableHref(basePath, state, { sort: null }))
  }
  const goPage = (p: number) => go(tableHref(basePath, state, { page: p }))

  const defaultIds = columns.filter(c => !c.sticky).map(c => c.id)
  const defaultWidths = Object.fromEntries(columns.map(c => [c.id, c.defaultWidth ?? 160]))
  const [colOrder, setColOrder] = useState<string[]>(defaultIds)
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths)
  const resizingRef = useRef<{ id: string; startX: number; startW: number } | null>(null)

  const key = (suffix: string) => `sdt-${suffix}:${storageId}:${userId ?? 'anon'}`

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
      setWidths(prev => { try { localStorage.setItem(key('widths'), JSON.stringify(prev)) } catch {} ; return prev })
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

  const colMap = Object.fromEntries(columns.map(c => [c.id, c]))
  const normalCols = columns.filter(c => !c.sticky)
  const orderedNormal = colOrder.map(id => colMap[id]).filter((c): c is ServerColDef<T> => !!c && !c.sticky)
  const missing = normalCols.filter(c => !colOrder.includes(c.id))
  const orderedCols = [...orderedNormal, ...missing]
  const stickyCols = columns.filter(c => c.sticky)

  function filterContent(col: ServerColDef<T>): React.ReactNode | undefined {
    if (!col.filter) return undefined
    const current = state.filters[col.id] ?? ''
    if (col.filter.type === 'text') {
      return <TextFilter value={current} placeholder={col.filter.placeholder ?? `Search ${col.label.toLowerCase()}…`} onCommit={v => applyFilter(col.id, v)} />
    }
    if (col.filter.type === 'select') {
      return (
        <select value={current} onChange={e => applyFilter(col.id, e.target.value || null)} className={selectClass}>
          <option value="">All {col.label}</option>
          {col.filter.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    return (
      <select value={current} onChange={e => applyFilter(col.id, e.target.value || null)} className={selectClass}>
        {TIME_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  // Only column-backed filters count toward the "Clear filters" affordance;
  // pages may keep other filter keys in the URL (e.g. a date range) that this
  // table doesn't own and shouldn't wipe.
  const colFilterIds = new Set(columns.filter(c => c.filter).map(c => c.id))
  const anyFilter = Object.keys(state.filters).some(k => colFilterIds.has(k))
  const clearedFilters = Object.fromEntries(Object.entries(state.filters).filter(([k]) => !colFilterIds.has(k)))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const firstRow = total === 0 ? 0 : (state.page - 1) * pageSize + 1
  const lastRow = Math.min(state.page * pageSize, total)

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToHorizontalAxis]} onDragEnd={handleDragEnd}>
        <div className={`bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700 group/hd">
              <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                <tr>
                  {orderedCols.map(col => (
                    <SortableHeader key={col.id}
                      col={col as ServerColDef<unknown>}
                      width={widths[col.id] ?? 160}
                      sortDir={state.sort === col.id ? state.dir : null}
                      onSort={() => applySort(col.id)}
                      onResizeStart={e => startResize(col.id, e)}
                      filterContent={filterContent(col)}
                      filterActive={!!state.filters[col.id]}
                      onClearFilter={() => applyFilter(col.id, null)} />
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
              {rows.length > 0 ? rows.map((row, i) => (
                <tr key={rowKey ? rowKey(row) : i} className="border-b border-gray-800 hover:bg-gray-800">
                  {orderedCols.map(col => <td key={col.id} className="px-4 py-3">{col.renderCell(row)}</td>)}
                  {stickyCols.map(col => (
                    <td key={col.id} className="px-2 py-3 sticky right-0 bg-gray-900 border-l border-gray-800">{col.renderCell(row)}</td>
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

      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
        <span>
          {total === 0 ? 'No rows' : `${firstRow}–${lastRow} of ${total}`}
          {anyFilter && <> · <button className="text-blue-400 hover:text-blue-300" onClick={() => go(tableHref(basePath, { ...state, filters: clearedFilters }))}>Clear filters</button></>}
        </span>
        {totalPages > 1 && (
          <span className="flex items-center gap-2">
            <button disabled={state.page <= 1} onClick={() => goPage(state.page - 1)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
            <span className="text-gray-400">Page {state.page} of {totalPages}</span>
            <button disabled={state.page >= totalPages} onClick={() => goPage(state.page + 1)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
          </span>
        )}
      </div>
    </div>
  )
}
