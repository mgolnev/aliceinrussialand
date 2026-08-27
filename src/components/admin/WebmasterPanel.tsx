"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  WebmasterSnapshot,
  WebmasterUrlItem,
  WebmasterUrlStatus,
} from "@/lib/yandex-webmaster-monitor";

type Filter = "ALL" | "RECOMMENDED" | WebmasterUrlStatus;

type RecrawlResponse = {
  error?: string;
  accepted?: string[];
  alreadyQueued?: string[];
  failed?: Array<{ url: string; error: string }>;
};

const STATUS_LABELS: Record<WebmasterUrlStatus, string> = {
  IN_SEARCH: "В поиске",
  QUEUED: "В очереди",
  EXCLUDED: "Исключена",
  CRAWLED: "Обойдена",
  ERROR: "Ошибка",
  UNKNOWN: "Неизвестна",
};

const STATUS_STYLES: Record<WebmasterUrlStatus, string> = {
  IN_SEARCH: "bg-emerald-100 text-emerald-800",
  QUEUED: "bg-sky-100 text-sky-800",
  EXCLUDED: "bg-amber-100 text-amber-900",
  CRAWLED: "bg-stone-100 text-stone-700",
  ERROR: "bg-rose-100 text-rose-800",
  UNKNOWN: "bg-violet-100 text-violet-800",
};

function displayDate(value: string | null): string {
  if (!value) return "ещё не обходилась";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "дата неизвестна"
    : new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function pathLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function canSelect(item: WebmasterUrlItem): boolean {
  return item.status !== "QUEUED" && item.status !== "ERROR";
}

export function WebmasterPanel() {
  const [snapshot, setSnapshot] = useState<WebmasterSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/webmaster", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | (WebmasterSnapshot & { error?: string })
        | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "Не удалось получить данные Вебмастера");
      }
      setSnapshot(data);
      setSelected((current) => {
        const allowed = new Set(data.items.filter(canSelect).map((item) => item.url));
        return new Set([...current].filter((url) => allowed.has(url)));
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось получить данные Вебмастера",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (snapshot?.items ?? []).filter((item) => {
      if (filter === "RECOMMENDED" && !item.recommended) return false;
      if (filter !== "ALL" && filter !== "RECOMMENDED" && item.status !== filter) {
        return false;
      }
      return (
        !normalizedQuery ||
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.url.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [filter, query, snapshot?.items]);

  const chooseRecommended = useCallback(() => {
    if (!snapshot) return;
    const limit = snapshot.quota?.remainder ?? 0;
    setSelected(
      new Set(
        snapshot.items
          .filter((item) => item.recommended && canSelect(item))
          .slice(0, limit)
          .map((item) => item.url),
      ),
    );
    setFilter("RECOMMENDED");
  }, [snapshot]);

  const submit = useCallback(async () => {
    if (!selected.size || !snapshot) return;
    if (
      !window.confirm(
        `Отправить ${selected.size} страниц в суточную очередь переобхода Яндекса?`,
      )
    ) {
      return;
    }
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/webmaster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [...selected] }),
      });
      const data = (await response.json().catch(() => null)) as RecrawlResponse | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "Не удалось отправить страницы");
      }
      const accepted = data.accepted?.length ?? 0;
      const already = data.alreadyQueued?.length ?? 0;
      const failed = data.failed?.length ?? 0;
      setMessage(
        `Принято: ${accepted}${already ? ` · уже были в очереди: ${already}` : ""}${failed ? ` · ошибки: ${failed}` : ""}.`,
      );
      setSelected(new Set());
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить страницы");
    } finally {
      setSending(false);
    }
  }, [refresh, selected, snapshot]);

  if (loading && !snapshot) {
    return (
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-8 text-sm text-stone-500">
        Получаем данные Яндекс Вебмастера…
      </div>
    );
  }

  if (!snapshot?.configured) {
    return (
      <div className="space-y-4">
        <section className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-6">
          <h2 className="text-lg font-semibold text-amber-950">
            Подключите Яндекс Вебмастер
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900/80">
            В серверных переменных окружения задайте OAuth-токен с доступом к
            подтверждённому сайту. Токен никогда не передаётся в браузер.
          </p>
          <div className="mt-4 space-y-2 rounded-2xl bg-white/80 p-4 font-mono text-xs text-stone-700">
            <p>YANDEX_WEBMASTER_TOKEN=…</p>
            <p>INDEXNOW_KEY=случайная-строка-от-8-до-128-символов</p>
          </div>
          <p className="mt-3 text-sm text-amber-900/70">
            Сейчас найдено {snapshot?.counts.total ?? 0} канонических страниц,
            включая {snapshot?.counts.posts ?? 0} публикаций.
          </p>
          <a
            href="https://yandex.ru/dev/webmaster/doc/ru/tasks/how-to-get-oauth"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-950 underline underline-offset-4"
          >
            Получить OAuth-токен
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </section>
        {error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const filters: Array<{ key: Filter; label: string; count?: number }> = [
    { key: "ALL", label: "Все", count: snapshot.counts.total },
    {
      key: "RECOMMENDED",
      label: "Рекомендуемые",
      count: snapshot.counts.recommended,
    },
    { key: "IN_SEARCH", label: "В поиске", count: snapshot.counts.inSearch },
    { key: "UNKNOWN", label: "Неизвестны", count: snapshot.counts.unknown },
    { key: "CRAWLED", label: "Обойдены", count: snapshot.counts.crawled },
    { key: "EXCLUDED", label: "Исключены", count: snapshot.counts.excluded },
    { key: "ERROR", label: "Ошибки", count: snapshot.counts.error },
    { key: "QUEUED", label: "В очереди", count: snapshot.counts.queued },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-stone-900">
              Состояние индексации
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-stone-600">
              Данные Яндекса сопоставлены с {snapshot.counts.total} каноническими
              страницами сайта. Обновлено {displayDate(snapshot.generatedAt)}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || sending}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Обновить
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-3">
            <p className="text-2xl font-semibold text-emerald-900">{snapshot.counts.inSearch}</p>
            <p className="mt-1 text-xs text-emerald-800/75">в поиске</p>
          </div>
          <div className="rounded-2xl bg-violet-50 p-3">
            <p className="text-2xl font-semibold text-violet-900">{snapshot.counts.unknown}</p>
            <p className="mt-1 text-xs text-violet-800/75">неизвестны</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3">
            <p className="text-2xl font-semibold text-amber-900">{snapshot.counts.excluded}</p>
            <p className="mt-1 text-xs text-amber-800/75">исключены</p>
          </div>
          <div className="rounded-2xl bg-sky-50 p-3">
            <p className="text-2xl font-semibold text-sky-900">
              {snapshot.quota?.remainder ?? 0}/{snapshot.quota?.daily ?? 0}
            </p>
            <p className="mt-1 text-xs text-sky-800/75">квота сегодня</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 ${snapshot.indexNowConfigured ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>
            IndexNow: {snapshot.indexNowConfigured ? "подключён" : "не настроен"}
          </span>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
            {snapshot.hostUrl}
          </span>
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-3 py-2 text-xs font-medium transition ${filter === item.key ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
              >
                {item.label}{item.count !== undefined ? ` · ${item.count}` : ""}
              </button>
            ))}
          </div>
          <label className="relative block lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
            <span className="sr-only">Найти страницу</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Название или URL"
              className="w-full rounded-full border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-stone-500"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-stone-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">
            Выбрано {selected.size}. Рекомендовано {snapshot.counts.recommended};
            отправка ограничена остатком суточной квоты.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={chooseRecommended}
              disabled={!snapshot.counts.recommended || !(snapshot.quota?.remainder ?? 0)}
              className="rounded-full border border-stone-300 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-45"
            >
              Выбрать рекомендуемые
            </button>
            {selected.size ? (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-full border border-stone-300 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                Снять выбор
              </button>
            ) : null}
            <button
              type="button"
              disabled={!selected.size || sending}
              onClick={() => void submit()}
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {sending ? "Отправляем…" : "Отправить на переобход"}
            </button>
          </div>
        </div>

        {message ? (
          <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {visible.map((item) => (
            <article
              key={item.url}
              className={`rounded-2xl border p-3.5 transition ${selected.has(item.url) ? "border-stone-500 bg-stone-50" : "border-stone-200/80 bg-white"}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(item.url)}
                  disabled={!canSelect(item)}
                  aria-label={`Выбрать ${item.label}`}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(item.url);
                      else next.delete(item.url);
                      return next;
                    });
                  }}
                  className="mt-1 h-4 w-4 rounded border-stone-300 accent-stone-900 disabled:opacity-40"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-stone-900">
                        {item.label}
                      </h3>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-stone-500 hover:text-stone-800"
                      >
                        <span className="truncate">{pathLabel(item.url)}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {item.recommended ? (
                        <span className="rounded-full bg-stone-900 px-2 py-1 text-[11px] font-medium text-white">
                          Рекомендуется
                        </span>
                      ) : null}
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-stone-600">
                    {item.statusDetail}
                    {item.lastAccess ? ` · последний обход ${displayDate(item.lastAccess)}` : ""}
                  </p>
                  {item.targetUrl ? (
                    <p className="mt-1 truncate text-xs text-amber-800">
                      Целевой URL: {item.targetUrl}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {!visible.length ? (
            <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
              Для выбранного фильтра страниц нет.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-5 text-sm leading-6 text-stone-600 sm:p-6">
        <h2 className="font-semibold text-stone-900">Как читать статусы</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <p className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />«В поиске» — страница уже участвует в выдаче.</p>
          <p className="flex gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />«Обойдена» означает, что робот загрузил страницу, но ещё не включил её в поиск.</p>
          <p className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />Исключённые страницы сначала нужно проверить по указанной причине, а не отправлять повторно вслепую.</p>
        </div>
      </section>
    </div>
  );
}
