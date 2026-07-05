'use client'

import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
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
  | 'agentVersions'
  | 'activityChart'
  | 'enforcement'
  | 'topBlocked'
  | 'recentActivity'
  | 'unenrolledOrgs'
  | 'quickActions'

type Layout = { left: WidgetId[]; right: WidgetId[] }

const DEFAULT_LAYOUT: Layout = {
  left:  ['agentHealth', 'activityChart', 'enforcement', 'recentActivity', 'quickActions'],
  right: ['needsAttention', 'agentVersions', 'unenrolledOrgs', 'topBlocked'],
}

const storageKey = (userId: string) => `dashboard-layout-v2:${userId}`

function SortableWidget({ id, children }: { id: WidgetId; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="relative group"
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700"
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
        const allSaved = new Set([...parsed.left, ...parsed.right])
        const allDefault = [...DEFAULT_LAYOUT.left, ...DEFAULT_LAYOUT.right]
        const missing = allDefault.filter(id => !allSaved.has(id)) as WidgetId[]
        setLayout({ left: parsed.left, right: [...parsed.right, ...missing] })
      }
    } catch {}
    setMounted(true)
  }, [userId])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function getColumn(id: string): 'left' | 'right' | null {
    if (layout.left.includes(id as WidgetId)) return 'left'
    if (layout.right.includes(id as WidgetId)) return 'right'
    if (id === 'left' || id === 'right') return id
    return null
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as WidgetId)
  }

  // Move item between containers live during drag
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeId = active.id as WidgetId
    const overId = over.id as string

    const fromCol = layout.left.includes(activeId) ? 'left' : layout.right.includes(activeId) ? 'right' : null
    if (!fromCol) return

    const toCol = layout.left.includes(overId as WidgetId) ? 'left'
      : layout.right.includes(overId as WidgetId) ? 'right'
      : (overId === 'left' || overId === 'right') ? overId as 'left' | 'right'
      : null
    if (!toCol || fromCol === toCol) return

    setLayout(prev => {
      const fromItems = prev[fromCol].filter(id => id !== activeId)
      const toItems = [...prev[toCol]]
      const overIndex = toItems.indexOf(overId as WidgetId)
      const insertAt = overIndex >= 0 ? overIndex : toItems.length
      toItems.splice(insertAt, 0, activeId)
      return { ...prev, [fromCol]: fromItems, [toCol]: toItems }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return
    const activeId = active.id as WidgetId
    const overId = over.id as WidgetId

    setLayout(prev => {
      const col = prev.left.includes(activeId) ? 'left' : prev.right.includes(activeId) ? 'right' : null
      if (!col) return prev
      const items = prev[col]
      const from = items.indexOf(activeId)
      const to = items.indexOf(overId)
      if (from === -1 || to === -1 || from === to) return prev
      const next = { ...prev, [col]: arrayMove(items, from, to) }
      try { localStorage.setItem(storageKey(userId), JSON.stringify(next)) } catch {}
      return next
    })

    // Save after cross-column moves (layout already updated in onDragOver)
    setLayout(prev => {
      try { localStorage.setItem(storageKey(userId), JSON.stringify(prev)) } catch {}
      return prev
    })
  }

  const staticCol = (ids: WidgetId[]) => (
    <div className="flex flex-col gap-4 flex-1">
      {ids.map(id => widgets[id] ? <div key={id}>{widgets[id]}</div> : null)}
    </div>
  )

  if (!mounted) {
    return (
      <div className="flex gap-6">
        {staticCol(DEFAULT_LAYOUT.left)}
        {staticCol(DEFAULT_LAYOUT.right)}
      </div>
    )
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6">
        <SortableContext id="left" items={layout.left} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4 flex-1 min-h-20">
            {layout.left.map(id => widgets[id] ? <SortableWidget key={id} id={id}>{widgets[id]}</SortableWidget> : null)}
          </div>
        </SortableContext>

        <SortableContext id="right" items={layout.right} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4 flex-1 min-h-20">
            {layout.right.map(id => widgets[id] ? <SortableWidget key={id} id={id}>{widgets[id]}</SortableWidget> : null)}
          </div>
        </SortableContext>
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
