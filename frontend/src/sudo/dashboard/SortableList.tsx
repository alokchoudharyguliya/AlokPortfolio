/**
 * Drag-to-reorder list (dnd-kit). Works with mouse, touch (press-and-hold on
 * the handle) and keyboard (focus the handle, Space to lift, arrows to move,
 * Space to drop). Calls `onReorder(ids)` once per drop.
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

import { Icon } from "@/ui/Icon";

import styles from "./Dashboard.module.css";

interface SortableListProps<T extends { id: number }> {
  items: T[];
  disabled?: boolean;
  onReorder: (ids: number[]) => void;
  renderRow: (item: T) => ReactNode;
  isHidden?: (item: T) => boolean;
  label: string;
}

export function SortableList<T extends { id: number }>({
  items,
  disabled,
  onReorder,
  renderRow,
  isHidden,
  label,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, from, to).map((i) => i.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul className={styles.rows} aria-label={label}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} hidden={isHidden?.(item)} disabled={disabled}>
              {renderRow(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  hidden,
  disabled,
  children,
}: {
  id: number;
  hidden?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging}
      data-hidden={hidden}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {disabled ? null : (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.handle}
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" />
        </button>
      )}
      {children}
    </li>
  );
}
