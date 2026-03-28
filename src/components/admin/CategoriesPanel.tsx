"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

function SortableItem({
  row,
  onDelete,
  busy,
}: {
  row: CategoryRow;
  onDelete: () => void;
  busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: row.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-lg px-1 text-stone-400 hover:text-stone-600"
        {...attributes}
        {...listeners}
        aria-label="Перетащить"
      >
        ⋮⋮
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900">{row.name}</p>
        <p className="truncate font-mono text-xs text-stone-500">{row.slug}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        className="shrink-0 rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        onClick={onDelete}
      >
        Удалить
      </button>
    </div>
  );
}

export function CategoriesPanel({ initial }: { initial: CategoryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const persistOrder = useCallback(
    async (next: CategoryRow[]) => {
      setBusy(true);
      setMessage(null);
      try {
        const res = await fetch("/api/admin/categories/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: next.map((r) => r.id) }),
        });
        if (!res.ok) {
          setMessage("Не удалось сохранить порядок");
          return;
        }
        setRows(next.map((r, i) => ({ ...r, sortOrder: i })));
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(rows, oldIndex, newIndex);
    setRows(next);
    void persistOrder(next);
  }

  async function addCategory() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string };
        setMessage(d?.error ?? "Ошибка");
        return;
      }
      const row = (await res.json()) as CategoryRow;
      setRows((prev) => [...prev, row].sort((a, b) => a.sortOrder - b.sortOrder));
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(id: string) {
    if (!window.confirm("Удалить категорию? Посты останутся во «Все».")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setMessage("Не удалось удалить");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">
        Порядок вкладок в ленте совпадает с порядком строк ниже. Пост без категории
        виден только во «Все».
      </p>

      <div className="rounded-[24px] border border-stone-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-stone-900">Новая категория</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-2xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-stone-400"
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            className="rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
            onClick={() => void addCategory()}
          >
            Добавить
          </button>
        </div>
      </div>

      {message ? (
        <p className="text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={rows.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <SortableItem
                  row={row}
                  busy={busy}
                  onDelete={() => void removeCategory(row.id)}
                />
              </li>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
