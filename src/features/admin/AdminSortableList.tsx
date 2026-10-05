import type { ReactNode } from 'react'
import { DragDropProvider, DragOverlay } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'

export interface AdminSortableItemState {
  handleRef: (element: Element | null) => void
  isDragging: boolean
  ref: (element: Element | null) => void
}

interface AdminSortableListProps<T> {
  className?: string
  disabled?: boolean
  getId: (item: T) => string
  items: T[]
  onMove: (activeId: string, targetId: string) => void
  renderItem: (item: T, state: AdminSortableItemState) => ReactNode
  renderOverlay: (item: T) => ReactNode
}

interface AdminSortableItemProps<T> {
  disabled: boolean
  id: string
  index: number
  item: T
  renderItem: AdminSortableListProps<T>['renderItem']
}

function AdminSortableItem<T>({
  disabled,
  id,
  index,
  item,
  renderItem,
}: AdminSortableItemProps<T>) {
  const { handleRef, isDragging, ref } = useSortable({
    id,
    index,
    disabled,
    transition: { duration: 180, easing: 'ease-out', idle: false },
  })

  return renderItem(item, { handleRef, isDragging, ref })
}

export function AdminSortableList<T>({
  className,
  disabled = false,
  getId,
  items,
  onMove,
  renderItem,
  renderOverlay,
}: AdminSortableListProps<T>) {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled || !isSortable(event.operation.source)) return
        const { id, index, initialIndex } = event.operation.source
        const target = items[index]
        if (initialIndex === index || !target) return
        onMove(String(id), getId(target))
      }}
    >
      <div className={className}>
        {items.map((item, index) => {
          const id = getId(item)
          return (
            <AdminSortableItem
              key={id}
              id={id}
              index={index}
              item={item}
              disabled={disabled}
              renderItem={renderItem}
            />
          )
        })}
      </div>
      <DragOverlay className="pointer-events-none z-50">
        {(source) => {
          const item = items.find((candidate) => getId(candidate) === source.id)
          return item ? (
            <div
              aria-hidden="true"
              inert
              className="w-full scale-[1.01] rounded-2xl bg-[#fffaf5] shadow-[0_18px_38px_-18px_rgba(54,41,31,0.45)]"
            >
              {renderOverlay(item)}
            </div>
          ) : null
        }}
      </DragOverlay>
    </DragDropProvider>
  )
}
