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

const DEFAULT_ORDER: WidgetId[] = [
  'agentHealth',
  'needsAttention',
  'enforcement',
  'topBlocked',
  'recentActivity',
  'unenrolledOrgs',
  'quickActions',
]

const storageKey = (userId: string) => `dashboard-widget-order:${userId}`

function SortableWidget({ id, children }: { id: string; children: React.ReactNode }) {
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

// Split a flat ordered list into two columns: left gets even indices, right gets odd
function toColumns(order: WidgetId[]): [WidgetId[], WidgetId[]] {
  const left: WidgetId[] = []
  const right: WidgetId[] = []
  order.forEach((id, i) => (i % 2 === 0 ? left : right).push(id))
  return [left, right]
}

export default function DashboardLayout({
  widgets,
  userId,
}: {
  widgets: Partial<Record<WidgetId, React.ReactNode>>
  userId: string
}) {
  const dndId = useId()
  const [order, setOrder] = useState<WidgetId[]>(DEFAULT_ORDER)
  const [activeId, setActiveId] = useState<WidgetId | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(userId))
      if (saved) {
        const parsed: WidgetId[] = JSON.parse(saved)
        const merged = [
          ...parsed.filter(id => DEFAULT_ORDER.includes(id)),
          ...DEFAULT_ORDER.filter(id => !parsed.includes(id)),
        ]
        setOrder(merged)
      }
    } catch {}
    setMounted(true)
  }, [userId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as WidgetId)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    setOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id as WidgetId), prev.indexOf(over.id as WidgetId))
      try { localStorage.setItem(storageKey(userId), JSON.stringify(next)) } catch {}
      return next
    })
  }

  const [leftIds, rightIds] = toColumns(order)

  const staticGrid = (ids: WidgetId[]) => (
    <div className="flex flex-col gap-4">
      {ids.map(id => widgets[id] ? <div key={id}>{widgets[id]}</div> : null)}
    </div>
  )

  if (!mounted) {
    const [l, r] = toColumns(DEFAULT_ORDER)
    return (
      <div className="flex gap-6">
        {staticGrid(l)}
        {staticGrid(r)}
      </div>
    )
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="flex gap-6">
          {/* Left column — even positions */}
          <div className="flex flex-col gap-4 flex-1">
            {leftIds.map(id =>
              widgets[id] ? (
                <SortableWidget key={id} id={id}>
                  {widgets[id]}
                </SortableWidget>
              ) : null
            )}
          </div>
          {/* Right column — odd positions */}
          <div className="flex flex-col gap-4 flex-1">
            {rightIds.map(id =>
              widgets[id] ? (
                <SortableWidget key={id} id={id}>
                  {widgets[id]}
                </SortableWidget>
              ) : null
            )}
          </div>
        </div>
      </SortableContext>

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
