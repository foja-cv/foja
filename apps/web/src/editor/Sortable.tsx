// Drag-and-drop reordering with dnd-kit. The handle also works from the keyboard (Space to pick
// up, arrows to move, Space to drop), and the ↑ ↓ buttons stay as the plain alternative.

import type { ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { t } from "./i18n";

export function SortableList({ ids, onMove, children }: { ids: string[]; onMove: (from: number, to: number) => void; children: ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ screenReaderInstructions: { draggable: t.dragInstructions } }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** An element of a SortableList; `children` gets the drag handle to place. */
export function SortableItem({ id, children, as: Tag = "div", className }: { id: string; children: (handle: ReactNode) => ReactNode; as?: "div" | "li"; className?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label={t.dragHandle}
      className="cursor-grab touch-none px-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  );
  return (
    <Tag
      ref={setNodeRef as never}
      className={`${className ?? ""} ${isDragging ? "relative z-10 opacity-80 shadow-lg" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children(handle)}
    </Tag>
  );
}
