"use client";

import { useState } from "react";
import {
  sortTelegramItemsNewestFirst,
  type TelegramFeedListItem,
} from "@/lib/telegram-feed-item-sort";
import { normalizeTelegramPostUrl } from "@/lib/telegram-post-url";

type TgItem = TelegramFeedListItem;

type Props = {
  defaultChannel: string;
};

function formatDate(iso: string | null) {
  if (!iso) return "Без даты";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "Без даты";
  }
}

/** Витрина t.me отдаёт посты от старых к новым — для списка нужны новые сверху. */
function mergeImportedHrefs(prev: string[], next: string[]): string[] {
  return [...new Set([...prev, ...next])];
}

const telegramCheckboxClass =
  "h-5 w-5 shrink-0 cursor-pointer rounded-full border-2 border-stone-300 bg-white accent-stone-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/45 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

export function TelegramImportPanel({ defaultChannel }: Props) {
  const [channel, setChannel] = useState(defaultChannel);
  const [items, setItems] = useState<TgItem[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [publish, setPublish] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  /** Нормализованные `href`, уже есть в БД как `telegramSourceUrl`. */
  const [importedHrefs, setImportedHrefs] = useState<string[]>([]);

  async function loadList(reset = true) {
    if (reset) {
      setLoading(true);
      setError(null);
      setDone(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const res = await fetch("/api/admin/telegram/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelUser: channel,
          limit: 20,
          before: reset ? null : nextBefore,
        }),
      });
      const data = (await res.json()) as {
        items?: TgItem[];
        nextBefore?: string | null;
        importedHrefs?: string[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        if (reset) setItems(null);
        return;
      }
      setNextBefore(data.nextBefore ?? null);
      const batch = data.items ?? [];
      const batchImported = data.importedHrefs ?? [];
      if (reset) {
        const sorted = sortTelegramItemsNewestFirst(batch);
        setItems(sorted);
        setImportedHrefs(batchImported);
        const sel: Record<string, boolean> = {};
        for (const it of sorted) {
          sel[it.messageId] = false;
        }
        setSelected(sel);
      } else {
        setItems((prev) =>
          sortTelegramItemsNewestFirst([...(prev ?? []), ...batch]),
        );
        setImportedHrefs((p) => mergeImportedHrefs(p, batchImported));
        setSelected((prev) => {
          const next = { ...prev };
          for (const it of batch) {
            next[it.messageId] = next[it.messageId] ?? false;
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function runImport() {
    if (!items) return;
    const imported = new Set(importedHrefs);
    const chosen = items.filter(
      (i) =>
        selected[i.messageId] &&
        !imported.has(normalizeTelegramPostUrl(i.href)),
    );
    if (!chosen.length) {
      setError("Отметьте хотя бы один пост");
      return;
    }
    setImporting(true);
    setError(null);
    setDone(null);
    const res = await fetch("/api/admin/telegram/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: chosen.map((i) => ({
          href: i.href,
          text: i.text,
          imageUrls: i.imageUrls,
          dateIso: i.dateIso,
          publish,
        })),
      }),
    });
    setImporting(false);
    const data = (await res.json().catch(() => null)) as {
      createdIds?: string[];
      error?: string;
    };
    if (!res.ok) {
      setError(data?.error ?? "Ошибка импорта");
      return;
    }
    const norms = chosen.map((i) => normalizeTelegramPostUrl(i.href));
    setImportedHrefs((p) => mergeImportedHrefs(p, norms));
    setSelected((s) => {
      const n = { ...s };
      for (const it of chosen) n[it.messageId] = false;
      return n;
    });
    setDone(`Импортировано постов: ${data.createdIds?.length ?? 0}`);
  }

  const importedSet = new Set(importedHrefs);
  function isAlreadyImported(it: TgItem): boolean {
    return importedSet.has(normalizeTelegramPostUrl(it.href));
  }

  return (
    <>
      <div className={items ? "space-y-6 pb-24 sm:pb-28" : "space-y-6"}>
        <div className="rounded-[24px] border border-stone-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Канал для предпросмотра
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <label className="block text-sm font-medium text-stone-700">
              Канал (username без @)
              <input
                className="mt-1 block w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-400 sm:max-w-md"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              />
            </label>
            <div className="mt-1 flex w-full min-w-0 flex-nowrap items-center justify-end gap-2 border-t border-stone-100 pt-3 sm:mt-2 sm:pt-3.5">
              <button
                type="button"
                disabled={loading}
                className="flex shrink-0 items-center rounded-full bg-stone-900 px-3 py-2 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-50 sm:px-5 sm:text-sm"
                onClick={() => void loadList()}
              >
                {loading ? "Загрузка…" : "Загрузить список"}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="text-sm text-stone-700">{done}</p>
        ) : null}

        {items ? (
          <div className="flex flex-col gap-4 rounded-[24px] border border-stone-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 transition hover:bg-stone-50/90">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className={telegramCheckboxClass}
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-snug tracking-tight text-stone-900">
                  Сразу публиковать после импорта
                </span>
                <span className="mt-1 block text-sm leading-snug text-stone-600">
                  Выключите, чтобы новые посты сохранялись как{" "}
                  <span className="font-medium text-stone-700">черновики</span>.
                </span>
              </span>
            </label>
            <ul className="space-y-2 rounded-[24px] border border-stone-200/60 bg-stone-50/50 p-2">
              {items.map((it) => {
                const imported = isAlreadyImported(it);
                return (
                  <li
                    key={it.messageId}
                    className={`flex items-center gap-3 rounded-2xl border border-stone-200/70 p-3 shadow-sm ${
                      imported
                        ? "bg-stone-100/80 opacity-90"
                        : "bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className={telegramCheckboxClass}
                      disabled={imported}
                      checked={imported ? false : Boolean(selected[it.messageId])}
                      onChange={() => toggle(it.messageId)}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="line-clamp-3 min-w-0 flex-1 text-sm leading-6 text-stone-800">
                          {it.text || "(без текста)"}
                        </p>
                        {imported ? (
                          <span className="shrink-0 rounded-full bg-stone-200/90 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                            Уже импортировано
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-stone-500">
                        {formatDate(it.dateIso)} · {it.imageUrls.length} изобр. ·{" "}
                        <a
                          href={it.href}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          открыть в Telegram
                        </a>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {items ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200/80 bg-[#fffdf9]/95 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_40px_-16px_rgba(60,44,29,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#fffdf9]/88">
          <div className="mx-auto flex max-w-5xl flex-row flex-nowrap items-center justify-end gap-2 px-3 sm:gap-3 sm:px-6">
            {nextBefore ? (
              <button
                type="button"
                disabled={loadingMore}
                className="shrink-0 whitespace-nowrap rounded-full border border-stone-300 bg-white px-3 py-2 text-[13px] font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-60 sm:px-4 sm:py-2.5 sm:text-sm"
                onClick={() => void loadList(false)}
              >
                {loadingMore ? "Загрузка…" : "Загрузить ещё"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={importing}
              className="shrink-0 whitespace-nowrap rounded-full bg-stone-900 px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-stone-800 active:scale-[0.99] disabled:opacity-60 sm:px-4 sm:py-2.5 sm:text-sm"
              onClick={() => void runImport()}
            >
              {importing ? "Импорт…" : "Импортировать"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
