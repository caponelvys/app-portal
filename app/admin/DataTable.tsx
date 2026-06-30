'use client'

import { useState, useEffect, useRef } from 'react'
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

export type ColDef<T> = {
  id: string
  label: string
  defaultWidth?: number
  sortable?: boolean
  sortValue?: (row: T) => string | number
  renderCell: (row: T) => React.ReactNode
  headerExtra?: React.ReactNode
}

type SortDir = 'asc' | 'desc' | null

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

function SortableHeader({
  col,
  width,
  sortDir,
  onSort,
  onResizeStart,
}: {
  col: ColDef<unknown>
  width: number
  sortDir: SortDir
  onSort: () => void
  onResizeStart: (e: React.MouseEvent) => void
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
          className="cursor-grab active:cursor-grabbing mr-1 opacity-0 group-hover/hd:opacity-100 transition-opacity"
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
        {col.headerExtra}
      </div>
      <div
        onMouseDown={onResizeStart}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/50 transition-colors group-hover/hd:bg-gray-700/50"
      />
    </th>
  )
}

export default function DataTable<T>({
  storageId,
  columns,
  rows,
  emptyMessage = 'No data.',
  rowKey,
}: {
  storageId: string
  columns: ColDef<T>[]
  rows: T[]
  emptyMessage?: string
  rowKey?: (row: T) => string
}) {
  const defaultIds = columns.map(c => c.id)
  const defaultWidths = Object.fromEntries(columns.map(c => [c.id, c.defaultWidth ?? 160]))

  const [colOrder, setColOrder] = useState<string[]>(defaultIds)
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const resizingRef = useRef<{ id: string; startX: number; startW: number } | null>(null)

  useEffect(() => {
    try {
      const o = localStorage.getItem(`dt-order:${storageId}`)
      if (o) { const p: string[] = JSON.parse(o); if (p.every(id => defaultIds.includes(id))) setColOrder(p) }
    } catch {}
    try {
      const w = localStorage.getItem(`dt-widths:${storageId}`)
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
        try { localStorage.setItem(`dt-widths:${storageId}`, JSON.stringify(prev)) } catch {}
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
      try { localStorage.setItem(`dt-order:${storageId}`, JSON.stringify(next)) } catch {}
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

  const colMap = Object.fromEntries(columns.map(c => [c.id, c]))
  const orderedCols = colOrder.map(id => colMap[id]).filter(Boolean)

  const sorted = sortCol && sortDir
    ? [...rows].sort((a, b) => {
        const col = colMap[sortCol]
        if (!col?.sortValue) return 0
        const av = col.sortValue(a), bv = col.sortValue(b)
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    : rows

  return (
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
                  />
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
              </tr>
            )) : (
              <tr>
                <td colSpan={orderedCols.length} className="px-4 py-10 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DndContext>
  )
}
