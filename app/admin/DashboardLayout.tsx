'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  pointerWithin,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useEffect, useId } from 'react'

export type WidgetId =
  | 'agentHealth'
  | 'needsAttention'
  | 'enforcement'
  | 'topBlocked'
  | 'recentActivity'
  | 'unenrolledOrgs'
  | 'quickActions'

type Layout = { left: WidgetId[]; right: WidgetId[] }

const DEFAULT_LAYOUT: Layout = {
  left:  ['agentHealth', 'enforcement', 'recentActivity', 'quickActions'],
  right: ['needsAttention', 'unenrolledOrgs', 'topBlocked'],
}

const storageKey = (userId: string) => `dashboard-layout-v2:${userId}`

function SortableWidget({ id, children }: { id: WidgetId; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="relative group"
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 right-3 z-20 p-1.5 rounded-md bg-gray-800 border border-gray-700 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700"
        title="Drag to reorder"
      >
        <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 4a1 1 0 100-2 1 1 0 000 2zM13 4a1 1 0 100-2 1 1 0 000 2zM7 8a1 1 0 100-2 1 1 0 000 2zM13 8a1 1 0 100-2 1 1 0 000 2zM7 12a1 1 0 100-2 1 1 0 000 2zM13 12a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
      </div>
      {children}
    </div>
  )
}

function Column({
  columnId,
  ids,
  widgets,
}: {
  columnId: string
  ids: WidgetId[]
  widgets: Partial<Record<WidgetId, React.ReactNode>>
}) {
  return (
    <SortableContext id={columnId} items={ids} strategy={verticalListSortingStrategy}>
      <div className="flex flex-col gap-4 flex-1 min-h-32">
        {ids.map(id =>
          widgets[id] ? (
            <SortableWidget key={id} id={id}>
              {widgets[id]}
            </SortableWidget>
          ) : null
        )}
      </div>
    </SortableContext>
  )
}

function findColumn(layout: Layout, id: WidgetId): 'left' | 'right' | null {
  if (layout.left.includes(id)) return 'left'
  if (layout.right.includes(id)) return 'right'
  return null
}

export default function DashboardLayout({
  widgets,
  userId,
}: {
  widgets: Partial<Record<WidgetId, React.ReactNode>>
  userId: string
}) {
  const dndId = useId()
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)
  const [activeId, setActiveId] = useState<WidgetId | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(userId))
      if (saved) {
        const parsed: Layout = JSON.parse(saved)
        const allIds = new Set([...parsed.left, ...parsed.right])
        const allDefault = [...DEFAULT_LAYOUT.left, ...DEFAULT_LAYOUT.right]
        // Append any new widgets not in saved layout to right column
        const missing = allDefault.filter(id => !allIds.has(id)) as WidgetId[]
        setLayout({ left: parsed.left, right: [...parsed.right, ...missing] })
      }
    } catch {}
    setMounted(true)
  }, [userId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function save(next: Layout) {
    try { localStorage.setItem(storageKey(userId), JSON.stringify(next)) } catch {}
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as WidgetId)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const activeId = active.id as WidgetId
    const overId = over.id as WidgetId | 'left' | 'right'

    setLayout(prev => {
      const fromCol = findColumn(prev, activeId)
      if (!fromCol) return prev

      // Dropped onto a column container (empty column drop zone)
      if (overId === 'left' || overId === 'right') {
        if (fromCol === overId) return prev
        const next: Layout = {
          left:  prev.left.filter(id => id !== activeId),
          right: prev.right.filter(id => id !== activeId),
          [overId]: [...prev[overId], activeId],
        }
        save(next)
        return next
      }

      const toCol = findColumn(prev, overId)
      if (!toCol) return prev

      if (fromCol === toCol) {
        // Same column — reorder
        const col = prev[fromCol]
        const next: Layout = {
          ...prev,
          [fromCol]: arrayMove(col, col.indexOf(activeId), col.indexOf(overId)),
        }
        save(next)
        return next
      } else {
        // Cross-column — move to new column at target position
        const toColItems = prev[toCol]
        const insertAt = toColItems.indexOf(overId)
        const newToCol = [...toColItems]
        newToCol.splice(insertAt, 0, activeId)
        const next: Layout = {
          left:  (fromCol === 'left' ? prev.left.filter(id => id !== activeId) : newToCol) as WidgetId[],
          right: (fromCol === 'right' ? prev.right.filter(id => id !== activeId) : newToCol) as WidgetId[],
        }
        // Fix: ensure we didn't double-add
        if (fromCol === 'left') {
          next.left = prev.left.filter(id => id !== activeId)
          next.right = newToCol as WidgetId[]
        } else {
          next.right = prev.right.filter(id => id !== activeId)
          next.left = newToCol as WidgetId[]
        }
        save(next)
        return next
      }
    })
  }

  if (!mounted) {
    return (
      <div className="flex gap-6">
        <div className="flex flex-col gap-4 flex-1">
          {DEFAULT_LAYOUT.left.map(id => widgets[id] ? <div key={id}>{widgets[id]}</div> : null)}
        </div>
        <div className="flex flex-col gap-4 flex-1">
          {DEFAULT_LAYOUT.right.map(id => widgets[id] ? <div key={id}>{widgets[id]}</div> : null)}
        </div>
      </div>
    )
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6">
        <Column columnId="left"  ids={layout.left}  widgets={widgets} />
        <Column columnId="right" ids={layout.right} widgets={widgets} />
      </div>

      <DragOverlay>
        {activeId && widgets[activeId] ? (
          <div className="opacity-90 rotate-1 scale-105 shadow-2xl ring-2 ring-blue-500 rounded-xl">
            {widgets[activeId]}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
