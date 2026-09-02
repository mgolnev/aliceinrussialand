"use client";

import { useState } from "react";
import { adminCredentials, readAdminResponseJson } from "@/lib/admin-fetch";

export type WanderCategoryOption = {
  id: string;
  name: string;
  isArchived: boolean;
  eligiblePostCount: number;
};

function postsLabel(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const noun = modulo100 >= 11 && modulo100 <= 14
    ? "публикаций"
    : modulo10 === 1 ? "публикация" : modulo10 >= 2 && modulo10 <= 4 ? "публикации" : "публикаций";
  return `${count} ${noun}`;
}

export function WanderSettingsForm({
  initialShowWanderEntry,
  initialExcludedCategoryIds,
  categories,
}: {
  initialShowWanderEntry: boolean;
  initialExcludedCategoryIds: string[];
  categories: WanderCategoryOption[];
}) {
  const [showWanderEntry, setShowWanderEntry] = useState(initialShowWanderEntry);
  const [excludedCategoryIds, setExcludedCategoryIds] = useState(initialExcludedCategoryIds);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const includedCount = categories.length - excludedCategoryIds.length;

  function setCategoryIncluded(categoryId: string, included: boolean) {
    setMessage(null);
    setExcludedCategoryIds((current) => included
      ? current.filter((id) => id !== categoryId)
      : current.includes(categoryId) ? current : [...current, categoryId]);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/wander", {
        ...adminCredentials,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showWanderEntry, excludedCategoryIds }),
      });
      const result = await readAdminResponseJson(response) as { error?: string } | null;
      if (!response.ok) {
        setMessage(result?.error?.trim() || "Не удалось сохранить");
        return;
      }
      setMessage("Сохранено");
    } catch {
      setMessage("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/90"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <section className="border-b border-stone-200/80 p-5 sm:p-6">
        <label className="flex cursor-pointer items-start justify-between gap-5">
          <span>
            <span className="block text-base font-medium text-stone-900">
              Показывать «не выбирай»
            </span>
            <span className="mt-1 block max-w-2xl text-sm leading-6 text-stone-500">
              Управляет входом на главной странице. Прямой адрес /wander останется доступен.
            </span>
          </span>
          <input
            type="checkbox"
            checked={showWanderEntry}
            onChange={(event) => {
              setMessage(null);
              setShowWanderEntry(event.target.checked);
            }}
            className="mt-1 size-5 shrink-0 accent-stone-900"
          />
        </label>
      </section>

      <section aria-labelledby="wander-categories-heading">
        <div className="flex flex-col gap-3 border-b border-stone-200/80 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <h2 id="wander-categories-heading" className="text-lg font-medium text-stone-900">
              Категории в прогулке
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
              Отмеченные категории участвуют в выборе. Новые категории будут включаться автоматически; публикации без категории тоже остаются в прогулке.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs tabular-nums text-stone-500">
              {includedCount} из {categories.length}
            </span>
            {excludedCategoryIds.length ? (
              <button
                type="button"
                className="text-sm font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 hover:text-stone-950"
                onClick={() => {
                  setExcludedCategoryIds([]);
                  setMessage(null);
                }}
              >
                Включить все
              </button>
            ) : null}
          </div>
        </div>

        {categories.length ? (
          <ul className="divide-y divide-stone-100">
            {categories.map((category) => {
              const included = !excludedCategoryIds.includes(category.id);
              return (
                <li key={category.id}>
                  <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-stone-50/70 sm:px-6">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-medium text-stone-900">{category.name}</span>
                        {category.isArchived ? (
                          <span className="text-[11px] uppercase tracking-wide text-stone-400">архивная</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {postsLabel(category.eligiblePostCount)} с изображениями
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={included}
                      aria-label={`Показывать категорию «${category.name}»`}
                      onChange={(event) => setCategoryIncluded(category.id, event.target.checked)}
                      className="size-5 shrink-0 accent-stone-900"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-8 text-sm text-stone-500 sm:px-6">Категорий пока нет.</p>
        )}
      </section>

      <footer className="flex min-h-20 items-center justify-between gap-4 border-t border-stone-200/80 bg-stone-50/60 px-5 py-4 sm:px-6">
        <p role="status" aria-live="polite" className={`text-sm ${message === "Сохранено" ? "text-emerald-700" : "text-red-600"}`}>
          {message ?? ""}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-wait disabled:opacity-50"
        >
          {busy ? "Сохраняю…" : "Сохранить"}
        </button>
      </footer>
    </form>
  );
}
