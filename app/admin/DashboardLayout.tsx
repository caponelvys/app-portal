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
  rectSortingStrategy,
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

function SortableWidget({ id, editing, children }: { id: string; editing: boolean; children: React.ReactNode }) {
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
      className={`relative ${editing ? 'ring-2 ring-blue-500/40 rounded-xl' : ''}`}
    >
      {editing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 bg-blue-600/90 backdrop-blur-sm rounded-t-xl py-2 cursor-grab active:cursor-grabbing select-none"
        >
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 4a1 1 0 100-2 1 1 0 000 2zM13 4a1 1 0 100-2 1 1 0 000 2zM7 8a1 1 0 100-2 1 1 0 000 2zM13 8a1 1 0 100-2 1 1 0 000 2zM7 12a1 1 0 100-2 1 1 0 000 2zM13 12a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          <span className="text-xs font-medium text-white">Drag to move</span>
        </div>
      )}
      <div className={editing ? 'pt-9' : ''}>
        {children}
      </div>
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
  const [order, setOrder] = useState<WidgetId[]>(DEFAULT_ORDER)
  const [activeId, setActiveId] = useState<WidgetId | null>(null)
  const [mounted, setMounted] = useState(false)
  const [editing, setEditing] = useState(false)

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

  function resetLayout() {
    setOrder(DEFAULT_ORDER)
    try { localStorage.removeItem(storageKey(userId)) } catch {}
  }

  return (
    <div>
      {/* Toolbar — always rendered to avoid hydration mismatch */}
      <div className="flex items-center justify-between mb-4">
        {editing ? (
          <p className="text-xs text-blue-400">Drag the blue bar on any widget to reorder it.</p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {editing && (
            <button
              onClick={resetLayout}
              className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-red-800 transition-colors"
            >
              Reset to default
            </button>
          )}
          <button
            onClick={() => setEditing(e => !e)}
            className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
              editing
                ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
                : 'text-gray-300 border-gray-700 hover:border-gray-500 hover:text-white'
            }`}
          >
            {editing ? 'Done' : 'Customize Layout'}
          </button>
        </div>
      </div>

      {/* Before mount: static grid (no drag context) */}
      {!mounted ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DEFAULT_ORDER.map(id => widgets[id] ? <div key={id}>{widgets[id]}</div> : null)}
        </div>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {order.map(id =>
                widgets[id] ? (
                  <SortableWidget key={id} id={id} editing={editing}>
                    {widgets[id]}
                  </SortableWidget>
                ) : null
              )}
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
      )}
    </div>
  )
}
