"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { adminCredentials, readAdminResponseJson } from "@/lib/admin-fetch";
import { normalizeTelegramPostUrl } from "@/lib/telegram-post-url";

function mergeImportedHrefs(prev: string[], next: string[]): string[] {
  return [...new Set([...prev, ...next])];
}

export type TelegramPickItem = {
  messageId: string;
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Выбор поста (закрытие листа — ответственность родителя после await) */
  onSelect: (item: TelegramPickItem) => void | Promise<void>;
  /** Нормализованные URL, импортированные в этой сессии (до обновления страницы) */
  sessionImportedHrefs?: string[];
};

function formatListDate(iso: string | null) {
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

function previewText(text: string, max = 120) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t || "Без текста";
  return `${t.slice(0, max).trim()}…`;
}

export function TelegramComposerPickSheet({
  open,
  onClose,
  onSelect,
  sessionImportedHrefs = [],
}: Props) {
  const [items, setItems] = useState<TelegramPickItem[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [apiImportedHrefs, setApiImportedHrefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importedSet = useMemo(() => {
    const merged = mergeImportedHrefs(apiImportedHrefs, sessionImportedHrefs);
    return new Set(merged.map((h) => normalizeTelegramPostUrl(h)).filter(Boolean));
  }, [apiImportedHrefs, sessionImportedHrefs]);

  const load = useCallback(
    async (before: string | null, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/telegram/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 30, before }),
          ...adminCredentials,
        });
        const data = (await readAdminResponseJson(res)) as {
          items?: TelegramPickItem[];
          nextBefore?: string | null;
          importedHrefs?: string[];
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Не удалось загрузить список");
          if (!append) setItems(null);
          return;
        }
        const batch = data.items ?? [];
        const batchImported = data.importedHrefs ?? [];
        setNextBefore(data.nextBefore ?? null);
        if (append) {
          setApiImportedHrefs((prev) => mergeImportedHrefs(prev, batchImported));
        } else {
          setApiImportedHrefs(batchImported);
        }
        if (append) {
          setItems((prev) => {
            const base = prev ?? [];
            const seen = new Set(base.map((i) => normalizeTelegramPostUrl(i.href)));
            const merged = [...base];
            for (const it of batch) {
              const k = normalizeTelegramPostUrl(it.href);
              if (!seen.has(k)) {
                seen.add(k);
                merged.push(it);
              }
            }
            return merged;
          });
        } else {
          setItems(batch);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      setItems(null);
      setNextBefore(null);
      setApiImportedHrefs([]);
      setError(null);
      setPicking(null);
      return;
    }
    void load(null, false);
  }, [open, load]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-composer-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(88vh,640px)] w-full flex-col rounded-t-[22px] bg-[#fffdf9] shadow-2xl sm:max-h-[80vh] sm:max-w-lg sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/80 px-4 py-3 sm:px-5">
          <h2
            id="tg-composer-sheet-title"
            className="text-base font-semibold tracking-tight text-stone-900 sm:text-lg"
          >
            Выбрать пост из Telegram
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
          {loading && !items?.length ? (
            <div className="flex flex-col items-center gap-3 py-16 text-stone-500">
              <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
              <p className="text-sm">Загружаем посты канала…</p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {items && items.length === 0 && !loading ? (
            <p className="py-12 text-center text-sm text-stone-500">
              Постов не найдено. Проверьте канал в настройках сайта.
            </p>
          ) : null}

          <ul className="space-y-2 pb-2">
            {(items ?? []).map((it) => {
              const busy = picking === it.messageId;
              const thumb = it.imageUrls[0];
              const hasPhoto = it.imageUrls.length > 0;
              const alreadyImported = importedSet.has(
                normalizeTelegramPostUrl(it.href),
              );
              return (
                <li key={it.messageId}>
                  <button
                    type="button"
                    disabled={Boolean(picking)}
                    onClick={() => {
                      setPicking(it.messageId);
                      void Promise.resolve(onSelect(it)).finally(() => {
                        setPicking(null);
                      });
                    }}
                    className={`flex w-full gap-3 rounded-2xl border p-3 text-left shadow-sm transition active:scale-[0.99] disabled:opacity-60 ${
                      alreadyImported
                        ? "border-stone-200/80 bg-stone-100/70 opacity-95 hover:border-stone-300 hover:bg-stone-100"
                        : "border-stone-200/90 bg-white hover:border-stone-300 hover:bg-stone-50/80"
                    }`}
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-stone-400">
                          Нет фото
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <time
                          className="text-[12px] font-medium text-stone-500"
                          dateTime={it.dateIso ?? undefined}
                        >
                          {formatListDate(it.dateIso)}
                        </time>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            hasPhoto
                              ? "bg-sky-100 text-sky-800"
                              : "bg-stone-200/80 text-stone-600"
                          }`}
                        >
                          {hasPhoto ? "С фото" : "Без фото"}
                        </span>
                        {alreadyImported ? (
                          <span className="rounded-full bg-stone-200/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                            Уже импортировано
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-stone-800">
                        {previewText(it.text)}
                      </p>
                    </div>
                    {busy ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin self-center text-emerald-600" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {nextBefore && items && items.length > 0 ? (
            <div className="pb-4 pt-1">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void load(nextBefore, true)}
                className="w-full rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка…
                  </span>
                ) : (
                  "Показать ещё"
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
