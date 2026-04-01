"use client";

import { useCallback, useEffect, useState } from "react";
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
  description: string;
  sortOrder: number;
};

function SortableItem({
  row,
  onDelete,
  onSaved,
  onRenameError,
  busy,
  savingId,
  onSavingChange,
}: {
  row: CategoryRow;
  onDelete: () => void;
  onSaved: (next: CategoryRow) => void;
  onRenameError: (msg: string) => void;
  busy: boolean;
  savingId: string | null;
  onSavingChange: (id: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: row.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.name);
  const [draftDescription, setDraftDescription] = useState(row.description || "");

  useEffect(() => {
    if (!editing) {
      setDraft(row.name);
      setDraftDescription(row.description || "");
    }
  }, [row.name, row.description, editing]);

  const rowBusy = busy || savingId === row.id;

  async function saveCategory() {
    const nextName = draft.trim();
    const nextDescription = draftDescription.trim();
    const prevDescription = (row.description || "").trim();
    const unchanged =
      nextName === row.name && nextDescription === prevDescription;
    if (!nextName || unchanged) {
      setEditing(false);
      setDraft(row.name);
      setDraftDescription(row.description || "");
      return;
    }
    onSavingChange(row.id);
    try {
      const res = await fetch(`/api/admin/categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          description: nextDescription,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string };
        onRenameError(
          d?.error?.trim() || "Не удалось сохранить. Попробуйте обновить страницу.",
        );
        return;
      }
      const updated = (await res.json()) as CategoryRow;
      onSaved(updated);
      setEditing(false);
    } finally {
      onSavingChange(null);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm sm:flex-nowrap"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-lg px-1 text-stone-400 hover:text-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={editing}
        {...attributes}
        {...listeners}
        aria-label="Перетащить"
      >
        ⋮⋮
      </button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex w-full flex-col gap-3">
            <input
              className="w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-stone-400"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={rowBusy}
              autoFocus
              placeholder="Название категории"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  void saveCategory();
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(row.name);
                  setDraftDescription(row.description || "");
                }
              }}
            />
            <textarea
              className="w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-stone-400"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              disabled={rowBusy}
              rows={3}
              placeholder="Короткое описание категории для SEO (2-3 предложения)"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={rowBusy || !draft.trim()}
                className="rounded-full bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                onClick={() => void saveCategory()}
              >
                Сохранить
              </button>
              <button
                type="button"
                disabled={rowBusy}
                className="rounded-full border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                onClick={() => {
                  setEditing(false);
                  setDraft(row.name);
                  setDraftDescription(row.description || "");
                }}
              >
                Отмена
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Для быстрого сохранения: Cmd/Ctrl + Enter
            </p>
          </div>
        ) : (
          <>
            <p className="font-medium text-stone-900">{row.name}</p>
            <p className="truncate font-mono text-xs text-stone-500">{row.slug}</p>
            {row.description?.trim() ? (
              <p className="mt-1 text-xs leading-5 text-stone-600">
                {row.description.trim()}
              </p>
            ) : (
              <p className="mt-1 text-xs text-stone-400">SEO-описание не задано</p>
            )}
          </>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
        {!editing ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-full px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-50"
            onClick={() => setEditing(true)}
          >
            Редактировать
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || editing || !!savingId}
          className="rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          onClick={onDelete}
        >
          Удалить
        </button>
      </div>
    </div>
  );
}

export function CategoriesPanel({ initial }: { initial: CategoryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
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
    if (savingId) return;
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
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string };
        setMessage(
          d?.error?.trim() || "Не удалось создать категорию. Попробуйте снова.",
        );
        return;
      }
      const row = (await res.json()) as CategoryRow;
      setRows((prev) => [...prev, row].sort((a, b) => a.sortOrder - b.sortOrder));
      setName("");
      setDescription("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function replaceRow(updated: CategoryRow) {
    setRows((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r)),
    );
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
        <div className="mt-3 grid gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-2xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-stone-400"
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy || !!savingId}
          />
          <textarea
            className="min-h-20 w-full rounded-2xl border border-stone-300 px-4 py-2.5 text-sm leading-6 outline-none focus:border-stone-400"
            placeholder="SEO-описание (опционально, 2-3 предложения)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy || !!savingId}
          />
          <div>
            <button
              type="button"
              disabled={busy || !!savingId || !name.trim()}
              className="rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
              onClick={() => void addCategory()}
            >
              Добавить
            </button>
          </div>
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
                  savingId={savingId}
                  onSavingChange={setSavingId}
                  onRenameError={(msg) => setMessage(msg)}
                  onSaved={(next) => {
                    setMessage(null);
                    replaceRow(next);
                    router.refresh();
                  }}
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
