"use client";

import { useState, type ReactNode } from "react";
import { normalizeTelegramPostUrl } from "@/lib/telegram-post-url";

type TgItem = {
  messageId: string;
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
};

type Props = {
  defaultChannel: string;
  /** Заголовок с сервера (page.tsx) — одинаковая разметка при SSR и гидрации. */
  children?: ReactNode;
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

function tgItemTimeMs(it: TgItem): number | null {
  if (!it.dateIso) return null;
  const t = Date.parse(it.dateIso);
  return Number.isNaN(t) ? null : t;
}

function tgMessageNum(it: TgItem): number {
  const tail = it.messageId.includes("/")
    ? (it.messageId.split("/").pop() ?? it.messageId)
    : it.messageId;
  const n = parseInt(tail, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Витрина t.me отдаёт посты от старых к новым — для списка нужны новые сверху. */
function mergeImportedHrefs(prev: string[], next: string[]): string[] {
  return [...new Set([...prev, ...next])];
}

function sortTgItemsNewestFirst(items: TgItem[]): TgItem[] {
  return [...items].sort((a, b) => {
    const ta = tgItemTimeMs(a);
    const tb = tgItemTimeMs(b);
    if (ta != null && tb != null && tb !== ta) return tb - ta;
    if (ta != null && tb == null) return -1;
    if (ta == null && tb != null) return 1;
    return tgMessageNum(b) - tgMessageNum(a);
  });
}

export function TelegramImportPanel({
  defaultChannel,
  children,
}: Props) {
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
        const sorted = sortTgItemsNewestFirst(batch);
        setItems(sorted);
        setImportedHrefs(batchImported);
        const sel: Record<string, boolean> = {};
        for (const it of sorted) {
          sel[it.messageId] = false;
        }
        setSelected(sel);
      } else {
        setItems((prev) =>
          sortTgItemsNewestFirst([...(prev ?? []), ...batch]),
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
    <div
      className={`rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)] ${
        items ? "pb-24 sm:pb-28" : ""
      }`}
    >
      <div className="space-y-3">
        {children}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            Канал (username без @)
            <input
              className="mt-1 block min-w-[12rem] max-w-full rounded-2xl border border-stone-300 px-3 py-2.5 font-mono text-sm shadow-inner outline-none focus:border-stone-400 sm:w-56"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={loading}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:opacity-60"
            onClick={() => void loadList()}
          >
            {loading ? "Загрузка…" : "Загрузить список"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="mt-4 text-sm text-emerald-700">{done}</p>
      ) : null}

      {items ? (
        <div className="mt-6 flex flex-col gap-4 border-t border-stone-200/60 pt-6">
          <label className="flex cursor-pointer items-start gap-4 rounded-2xl border-2 border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-4 shadow-[0_4px_20px_-8px_rgba(5,150,105,0.25)] ring-1 ring-emerald-100/60 transition hover:border-emerald-300 hover:shadow-[0_6px_24px_-8px_rgba(5,150,105,0.3)]">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-stone-300 text-emerald-700 focus:ring-2 focus:ring-emerald-600/30"
            />
            <span className="min-w-0">
              <span className="block text-base font-semibold tracking-tight text-stone-900">
                Сразу публиковать после импорта
              </span>
              <span className="mt-1 block text-sm leading-snug text-stone-600">
                По умолчанию включено. Выключите, чтобы новые посты сохранялись как{" "}
                <span className="font-medium text-stone-700">черновики</span>.
              </span>
            </span>
          </label>
          <ul className="space-y-2 rounded-[24px] border border-stone-100 bg-stone-50/60 p-2">
            {items.map((it) => {
              const imported = isAlreadyImported(it);
              return (
                <li
                  key={it.messageId}
                  className={`flex gap-3 rounded-2xl border border-stone-100 p-3 shadow-sm ${
                    imported
                      ? "bg-stone-100/80 opacity-90"
                      : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
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
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200/80 bg-[#fffdf9]/95 shadow-[0_-10px_40px_-16px_rgba(60,44,29,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#fffdf9]/88">
        <div
          className={`mx-auto flex max-w-5xl flex-col gap-2 px-3 py-3 sm:px-6 sm:py-3.5 ${nextBefore ? "sm:flex-row sm:items-center sm:justify-between sm:gap-4" : "sm:flex-row sm:justify-end"}`}
        >
          {nextBefore ? (
            <button
              type="button"
              disabled={loadingMore}
              className="w-full shrink-0 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-60 sm:w-auto"
              onClick={() => void loadList(false)}
            >
              {loadingMore ? "Загрузка…" : "Загрузить более старые"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={importing}
            className="w-full shrink-0 rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-60 sm:w-auto"
            onClick={() => void runImport()}
          >
            {importing ? "Импорт…" : "Импортировать выбранные"}
          </button>
        </div>
        <div
          className="h-[env(safe-area-inset-bottom,0px)] shrink-0 bg-[#fffdf9]/95 supports-[backdrop-filter]:bg-[#fffdf9]/88"
          aria-hidden
        />
      </div>
    ) : null}
    </>
  );
}
