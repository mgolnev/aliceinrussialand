"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { dispatchFeedRefreshMerge } from "@/lib/feed-refresh";
import type { SocialImportItem, SocialPlatform } from "@/lib/social-import/types";
import { normalizeSourceUrl } from "@/lib/social-import/normalize";
import { normalizeTelegramPostUrl } from "@/lib/telegram-post-url";

type Props = {
  defaultInstagramAccount?: string;
  defaultBehanceAccount?: string;
  defaultTelegramChannel?: string;
};

type PanelPlatform = SocialPlatform | "telegram";

type TelegramPreviewItem = {
  messageId: string;
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
};

const LS_KEY_PLATFORM = "admin.socialImport.platform";
const LS_KEY_TELEGRAM = "admin.socialImport.telegramChannel";
const LS_KEY_INSTAGRAM = "admin.socialImport.instagramAccount";
const LS_KEY_BEHANCE = "admin.socialImport.behanceAccount";

const checkboxClass =
  "h-5 w-5 shrink-0 cursor-pointer rounded-full border-2 border-stone-300 bg-white accent-stone-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/45 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

function formatDate(iso: string | null): string {
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

function sortNewest<T extends SocialImportItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = a.dateIso ? Date.parse(a.dateIso) : 0;
    const tb = b.dateIso ? Date.parse(b.dateIso) : 0;
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
}

function itemUiId(it: SocialImportItem): string {
  return `${it.externalId}::${it.href}`;
}

function dedupeItems<T extends SocialImportItem>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const id = itemUiId(it);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

export function SocialImportPanel({
  defaultInstagramAccount = "",
  defaultBehanceAccount = "",
  defaultTelegramChannel = "",
}: Props) {
  const router = useRouter();
  const [platform, setPlatform] = useState<PanelPlatform>("telegram");
  const [instagramAccount, setInstagramAccount] = useState(defaultInstagramAccount);
  const [behanceAccount, setBehanceAccount] = useState(defaultBehanceAccount);
  const [telegramChannel, setTelegramChannel] = useState(defaultTelegramChannel);
  const [items, setItems] = useState<SocialImportItem[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [publish, setPublish] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [importedSourceUrls, setImportedSourceUrls] = useState<string[]>([]);
  const [importSuccessFlash, setImportSuccessFlash] = useState(false);

  useEffect(() => {
    try {
      const savedPlatform = localStorage.getItem(LS_KEY_PLATFORM);
      if (
        savedPlatform === "telegram" ||
        savedPlatform === "instagram" ||
        savedPlatform === "behance"
      ) {
        setPlatform(savedPlatform);
      }
      const savedTg = localStorage.getItem(LS_KEY_TELEGRAM);
      const savedIg = localStorage.getItem(LS_KEY_INSTAGRAM);
      const savedBh = localStorage.getItem(LS_KEY_BEHANCE);
      if (savedTg) setTelegramChannel(savedTg);
      if (savedIg) setInstagramAccount(savedIg);
      if (savedBh) setBehanceAccount(savedBh);
    } catch {
      // localStorage может быть недоступен в ограниченных окружениях.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_PLATFORM, platform);
      localStorage.setItem(LS_KEY_TELEGRAM, telegramChannel);
      localStorage.setItem(LS_KEY_INSTAGRAM, instagramAccount);
      localStorage.setItem(LS_KEY_BEHANCE, behanceAccount);
    } catch {
      // Игнорируем ошибки хранилища, UI продолжает работать без персистентности.
    }
  }, [platform, telegramChannel, instagramAccount, behanceAccount]);

  const account =
    platform === "telegram"
      ? telegramChannel
      : platform === "instagram"
        ? instagramAccount
        : behanceAccount;

  async function loadList(reset = true) {
    if (reset) {
      setLoading(true);
      setError(null);
      setDone(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const res =
        platform === "telegram"
          ? await fetch("/api/admin/telegram/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                channelUser: account,
                limit: 20,
                before: reset ? null : nextCursor,
              }),
            })
          : await fetch("/api/admin/social/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform,
                account,
                limit: 20,
                before: reset ? null : nextCursor,
              }),
            });

      const data = (await res.json()) as
        | {
            items?: SocialImportItem[];
            nextCursor?: string | null;
            importedSourceUrls?: string[];
            error?: string;
          }
        | {
            items?: TelegramPreviewItem[];
            nextBefore?: string | null;
            importedHrefs?: string[];
            error?: string;
          };
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        if (reset) setItems(null);
        return;
      }

      const mappedItems: SocialImportItem[] =
        platform === "telegram"
          ? ((data.items as TelegramPreviewItem[] | undefined) ?? []).map((it) => ({
              externalId: it.messageId,
              href: it.href,
              text: it.text,
              imageUrls: it.imageUrls,
              dateIso: it.dateIso,
            }))
          : ((data.items as SocialImportItem[] | undefined) ?? []);
      const importedUrls =
        platform === "telegram"
          ? (((data as { importedHrefs?: string[] }).importedHrefs ?? []).map((u) =>
              normalizeTelegramPostUrl(u),
            ))
          : ((data as { importedSourceUrls?: string[] }).importedSourceUrls ?? []);

      setNextCursor(
        platform === "telegram"
          ? ((data as { nextBefore?: string | null }).nextBefore ?? null)
          : ((data as { nextCursor?: string | null }).nextCursor ?? null),
      );
      if (reset) {
        const sorted = sortNewest(dedupeItems(mappedItems));
        setItems(sorted);
        setImportedSourceUrls(importedUrls);
        const nextSel: Record<string, boolean> = {};
        for (const it of sorted) nextSel[itemUiId(it)] = false;
        setSelected(nextSel);
      } else {
        const batch = dedupeItems(mappedItems);
        setItems((prev) => sortNewest(dedupeItems([...(prev ?? []), ...batch])));
        setImportedSourceUrls((prev) => [
          ...new Set([...(prev ?? []), ...importedUrls]),
        ]);
        setSelected((prev) => {
          const n = { ...prev };
          for (const it of batch) n[itemUiId(it)] = n[itemUiId(it)] ?? false;
          return n;
        });
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function isAlreadyImported(it: SocialImportItem): boolean {
    const norm =
      platform === "telegram"
        ? normalizeTelegramPostUrl(it.href)
        : normalizeSourceUrl(platform, it.href);
    return importedSourceUrls.includes(norm);
  }

  async function runImport() {
    if (!items) return;
    const chosen = items.filter((it) => selected[itemUiId(it)] && !isAlreadyImported(it));
    if (!chosen.length) {
      setError("Отметьте хотя бы один элемент");
      return;
    }
    setImporting(true);
    setImportSuccessFlash(false);
    setError(null);
    setDone(null);
    const res =
      platform === "telegram"
        ? await fetch("/api/admin/telegram/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publish,
              items: chosen.map((it) => ({
                href: it.href,
                text: it.text,
                imageUrls: it.imageUrls,
                dateIso: it.dateIso,
                publish,
              })),
            }),
          })
        : await fetch("/api/admin/social/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform,
              publish,
              items: chosen,
            }),
          });
    const data = (await res.json().catch(() => null)) as {
      createdIds?: string[];
      error?: string;
    } | null;
    setImporting(false);
    if (!res.ok) {
      setError(data?.error ?? "Ошибка импорта");
      return;
    }
    const justImported = chosen.map((it) =>
      platform === "telegram"
        ? normalizeTelegramPostUrl(it.href)
        : normalizeSourceUrl(platform, it.href),
    );
    setImportedSourceUrls((prev) => [...new Set([...prev, ...justImported])]);
    setSelected((prev) => {
      const n = { ...prev };
      for (const it of chosen) n[itemUiId(it)] = false;
      return n;
    });
    setDone(`Импортировано: ${data?.createdIds?.length ?? 0}`);
    setImportSuccessFlash(true);
    setTimeout(() => setImportSuccessFlash(false), 2000);
    dispatchFeedRefreshMerge();
    router.refresh();
  }

  return (
    <>
      <div className={items ? "space-y-6 pb-24 sm:pb-28" : "space-y-6"}>
        <div className="rounded-[24px] border border-stone-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Источник импорта
          </h2>
          <div className="mt-3 grid gap-3 sm:max-w-xl sm:grid-cols-2">
            <label className="text-sm font-medium text-stone-700">
              Платформа
              <select
                className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-stone-400"
                value={platform}
                onChange={(e) => {
                  const next = e.target.value as PanelPlatform;
                  setPlatform(next);
                  setItems(null);
                  setSelected({});
                  setImportedSourceUrls([]);
                  setNextCursor(null);
                  setError(null);
                  setDone(null);
                }}
              >
                <option value="telegram">Telegram</option>
                <option value="instagram">Instagram</option>
                <option value="behance">Behance</option>
              </select>
            </label>
            <label className="text-sm font-medium text-stone-700">
              {platform === "telegram"
                ? "Канал (username без @)"
                : "Username"}
              <input
                className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-400"
                value={account}
                onChange={(e) => {
                  if (platform === "telegram") setTelegramChannel(e.target.value);
                  else if (platform === "instagram") setInstagramAccount(e.target.value);
                  else setBehanceAccount(e.target.value);
                }}
                placeholder={
                  platform === "telegram"
                    ? "telegram_channel"
                    : platform === "instagram"
                      ? "instagram_username"
                      : "behance_username"
                }
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end border-t border-stone-100 pt-3">
            <button
              type="button"
              disabled={loading}
              className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-50"
              onClick={() => void loadList(true)}
            >
              {loading ? "Загрузка..." : "Загрузить список"}
            </button>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {done ? <p className="text-sm text-stone-700">{done}</p> : null}

        {items ? (
          <div className="flex flex-col gap-4 rounded-[24px] border border-stone-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 transition hover:bg-stone-50/90">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className={checkboxClass}
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-snug tracking-tight text-stone-900">
                  Сразу публиковать после импорта
                </span>
              </span>
            </label>

            <ul className="space-y-2 rounded-[24px] border border-stone-200/60 bg-stone-50/50 p-2">
              {items.map((it) => {
                const imported = isAlreadyImported(it);
                return (
                  <li
                    key={itemUiId(it)}
                    className={`flex items-center gap-3 rounded-2xl border border-stone-200/70 p-3 shadow-sm ${
                      imported ? "bg-stone-100/80 opacity-90" : "bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      disabled={imported}
                      checked={imported ? false : Boolean(selected[itemUiId(it)])}
                      onChange={() => toggle(itemUiId(it))}
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
                          открыть источник
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
            {nextCursor ? (
              <button
                type="button"
                disabled={loadingMore}
                className="shrink-0 whitespace-nowrap rounded-full border border-stone-300 bg-white px-3 py-2 text-[13px] font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-60 sm:px-4 sm:py-2.5 sm:text-sm"
                onClick={() => void loadList(false)}
              >
                {loadingMore ? "Загрузка..." : "Загрузить еще"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={importing}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors duration-300 disabled:opacity-60 sm:px-4 sm:py-2.5 sm:text-sm ${
                importSuccessFlash
                  ? "bg-emerald-600 hover:bg-emerald-600 active:bg-emerald-700"
                  : "bg-stone-900 hover:bg-stone-800 active:scale-[0.99]"
              }`}
              onClick={() => void runImport()}
            >
              {importing ? (
                "Импорт..."
              ) : importSuccessFlash ? (
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                  Готово
                </span>
              ) : (
                "Импортировать"
              )}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
