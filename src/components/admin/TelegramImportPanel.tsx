"use client";

import { useState } from "react";

type TgItem = {
  messageId: string;
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
};

type Props = { defaultChannel: string };

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

export function TelegramImportPanel({ defaultChannel }: Props) {
  const [channel, setChannel] = useState(defaultChannel);
  const [items, setItems] = useState<TgItem[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [publish, setPublish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

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
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        if (reset) setItems(null);
        return;
      }
      setNextBefore(data.nextBefore ?? null);
      if (reset) {
        setItems(data.items ?? []);
        const sel: Record<string, boolean> = {};
        for (const it of data.items ?? []) {
          sel[it.messageId] = false;
        }
        setSelected(sel);
      } else {
        setItems((prev) => [...(prev ?? []), ...(data.items ?? [])]);
        setSelected((prev) => {
          const next = { ...prev };
          for (const it of data.items ?? []) {
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
    const chosen = items.filter((i) => selected[i.messageId]);
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
    setDone(`Импортировано постов: ${data.createdIds?.length ?? 0}`);
  }

  return (
    <div className="space-y-6 rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          Канал (username без @)
          <input
            className="mt-1 block w-56 rounded-2xl border border-stone-300 px-3 py-2.5 font-mono text-sm shadow-inner outline-none focus:border-stone-400"
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

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {done ? <p className="text-sm text-emerald-700">{done}</p> : null}

      {items ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            Сразу публиковать после импорта
          </label>
          <ul className="max-h-[520px] space-y-2 overflow-y-auto rounded-[24px] border border-stone-100 bg-stone-50/60 p-2">
            {items.map((it) => (
              <li
                key={it.messageId}
                className="flex gap-3 rounded-2xl border border-stone-100 bg-white p-3 shadow-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(selected[it.messageId])}
                  onChange={() => toggle(it.messageId)}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-3 text-sm leading-6 text-stone-800">
                    {it.text || "(без текста)"}
                  </p>
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
            ))}
          </ul>
          <button
            type="button"
            disabled={importing}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"
            onClick={() => void runImport()}
          >
            {importing ? "Импорт…" : "Импортировать выбранные"}
          </button>
          {nextBefore ? (
            <button
              type="button"
              disabled={loadingMore}
              className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 shadow-sm disabled:opacity-60"
              onClick={() => void loadList(false)}
            >
              {loadingMore ? "Загрузка…" : "Загрузить более старые"}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
