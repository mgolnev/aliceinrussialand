"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
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
import {
  Edit3,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );

  function updateMenuPosition() {
    const el = menuTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    setMenuPos({
      top: rect.bottom + gap,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onReposition = () => updateMenuPosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (menuTriggerRef.current?.contains(t)) return;
      if (menuPanelRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (editing) setMenuOpen(false);
  }, [editing]);

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

  const menuDisabled = rowBusy;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-stretch overflow-hidden rounded-[24px] border border-stone-200/80 bg-white/95 shadow-[0_8px_30px_-10px_rgba(60,44,29,0.15)] backdrop-blur-sm sm:rounded-[30px]"
    >
      <div className="flex w-9 shrink-0 flex-col items-center pt-3 sm:w-10 sm:pt-4">
        <button
          type="button"
          className="cursor-grab touch-none rounded-md px-1 py-2 text-stone-400 transition hover:text-stone-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          disabled={editing}
          {...attributes}
          {...listeners}
          aria-label="Перетащить"
        >
          <span className="select-none text-sm leading-none tracking-tighter">
            ⋮⋮
          </span>
        </button>
      </div>

      <div className="relative min-w-0 overflow-x-hidden">
        {editing ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-3 pb-2.5 pt-3 sm:px-5 sm:pb-3 sm:pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Редактирование категории
              </span>
              <button
                type="button"
                aria-label="Закрыть редактирование"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90"
                disabled={rowBusy}
                onClick={() => {
                  setEditing(false);
                  setDraft(row.name);
                  setDraftDescription(row.description || "");
                }}
              >
                <X size={18} />
              </button>
            </header>
            <div className="flex flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4">
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
                rows={4}
                placeholder="Короткое описание категории для SEO (2-3 предложения)"
              />
              <div className="mt-1 flex w-full min-w-0 flex-nowrap items-center justify-between gap-2 border-t border-stone-100 pt-3 sm:mt-2 sm:pt-3.5">
                <button
                  type="button"
                  disabled={rowBusy}
                  className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-medium text-stone-500 transition-colors hover:bg-stone-100 active:scale-95 disabled:opacity-50 sm:px-4 sm:text-sm"
                  onClick={() => {
                    setEditing(false);
                    setDraft(row.name);
                    setDraftDescription(row.description || "");
                  }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={rowBusy || !draft.trim()}
                  className="flex shrink-0 items-center rounded-full bg-stone-900 px-3 py-2 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-50 sm:px-5 sm:text-sm"
                  onClick={() => void saveCategory()}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-3 py-3 sm:px-5 sm:py-5">
            <header className="relative mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-0.5">
                <p className="text-[15px] font-semibold leading-snug text-stone-900 sm:text-base">
                  {row.name}
                </p>
                <p
                  className="truncate font-mono text-[13px] text-stone-400"
                  title={row.slug}
                >
                  {row.slug}
                </p>
              </div>
              <div className="relative flex shrink-0 items-center gap-1.5">
                <button
                  ref={menuTriggerRef}
                  type="button"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="Действия"
                  disabled={menuDisabled}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90 disabled:opacity-50"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <MoreHorizontal size={18} />
                </button>
                {menuOpen && menuPos
                  ? createPortal(
                      <div
                        ref={menuPanelRef}
                        className="fixed z-[100] w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                        style={{
                          top: menuPos.top,
                          right: menuPos.right,
                        }}
                        role="menu"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            setEditing(true);
                          }}
                        >
                          <Edit3 size={16} className="text-stone-400" />
                          Редактировать
                        </button>
                        <button
                          type="button"
                          disabled={menuDisabled}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            onDelete();
                          }}
                        >
                          <Trash2 size={16} className="text-red-400" />
                          Удалить
                        </button>
                        <div className="my-1.5 h-px bg-stone-100" />
                        <Link
                          href={`/category/${encodeURIComponent(row.slug)}`}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                        >
                          <ExternalLink size={16} className="text-stone-400" />
                          Открыть раздел
                        </Link>
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
            </header>
            {row.description?.trim() ? (
              <div className="min-w-0 whitespace-pre-wrap text-pretty text-[15px] leading-relaxed text-stone-800 sm:text-[16px] sm:leading-8">
                {row.description.trim()}
              </div>
            ) : (
              <div className="min-w-0 text-pretty text-[15px] leading-relaxed text-stone-400 sm:text-[16px] sm:leading-8">
                SEO-описание не задано
              </div>
            )}
          </div>
        )}
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
      <div className="rounded-[24px] border border-stone-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Новая категория
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <input
            className="w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-stone-400"
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy || !!savingId}
          />
          <textarea
            className="min-h-20 w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-stone-400"
            placeholder="SEO-описание (опционально, 2-3 предложения)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy || !!savingId}
          />
          <div className="mt-1 flex w-full min-w-0 flex-nowrap items-center justify-end gap-2 border-t border-stone-100 pt-3 sm:mt-2 sm:pt-3.5">
            <button
              type="button"
              disabled={busy || !!savingId || !name.trim()}
              className="flex shrink-0 items-center rounded-full bg-stone-900 px-3 py-2 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-50 sm:px-5 sm:text-sm"
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
