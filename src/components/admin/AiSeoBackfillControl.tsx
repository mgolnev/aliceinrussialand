"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AiSeoWorkerStatus } from "@/lib/ai-seo-worker";

export type AiSeoBackfillSnapshot = {
  postsNeedingSeo: number;
  imagesNeedingAlt: number;
  pending: number;
  running: number;
  review: number;
  failed: number;
  worker: AiSeoWorkerStatus;
};

type BackfillResponse = {
  error?: string;
  status?: AiSeoBackfillSnapshot;
};

function remainingText(status: AiSeoBackfillSnapshot) {
  const parts = [];
  if (status.postsNeedingSeo) {
    parts.push(`${status.postsNeedingSeo} SEO-текстов`);
  }
  if (status.imagesNeedingAlt) {
    parts.push(`${status.imagesNeedingAlt} alt для фото`);
  }
  return parts.join(" · ");
}

export function AiSeoBackfillControl({
  initial,
}: {
  initial: AiSeoBackfillSnapshot;
}) {
  const [status, setStatus] = useState(initial);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/seo/backfill", { cache: "no-store" });
      const next = (await res.json().catch(() => null)) as AiSeoBackfillSnapshot | null;
      if (!res.ok || !next) throw new Error("status unavailable");
      setStatus(next);
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    }
  }, []);

  const isProcessing = status.pending > 0 || status.running > 0;
  useEffect(() => {
    if (!isProcessing && !status.worker.enabled) return;
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 10_000);
    return () => window.clearInterval(timer);
  }, [isProcessing, status.worker.enabled, refreshStatus]);

  const start = useCallback(async () => {
    const count = status.postsNeedingSeo + status.imagesNeedingAlt;
    if (!count) return;
    if (
      !window.confirm(
        "Подготовить SEO и alt для уже опубликованных материалов? Ручные поля не будут изменены.",
      )
    ) {
      return;
    }

    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/seo/backfill", { method: "POST" });
      const data = (await res.json().catch(() => null)) as BackfillResponse | null;
      if (!res.ok || !data?.status) {
        throw new Error(data?.error ?? "Не удалось поставить материалы в очередь");
      }
      setStatus(data.status);
      setMessage(data.status.worker.enabled
        ? "Задачи сохранены. Сервер обработает очередь последовательно — вкладку можно закрыть."
        : "Задачи сохранены. Дальнейшая обработка зависит от внешнего cron или ручного запуска.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось запустить подготовку SEO");
    } finally {
      setWorking(false);
    }
  }, [status.imagesNeedingAlt, status.postsNeedingSeo]);

  const processNow = useCallback(async () => {
    const batch = status.worker.enabled;
    if (!window.confirm(batch
      ? "Обработать всю накопленную очередь SEO и alt? Задачи пойдут по одной на сервере; ручные поля не изменятся."
      : "Обработать следующую SEO-задачу сейчас? Ручные поля не будут изменены.")) {
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/seo/backfill?mode=${batch ? "process-all" : "process"}`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as BackfillResponse | null;
      if (!res.ok || !data?.status) {
        throw new Error(data?.error ?? "Не удалось обработать очередь");
      }
      setStatus(data.status);
      setMessage(batch
        ? "Запуск всей очереди принят. Обработка последовательная; вкладку можно закрыть."
        : "Одна задача обработана. Статус обновлён.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обработать очередь");
    } finally {
      setWorking(false);
    }
  }, [status.worker.enabled]);

  const remaining = remainingText(status);
  const isComplete = !status.postsNeedingSeo && !status.imagesNeedingAlt && !isProcessing;

  return (
    <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-stone-900">
            <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
            SEO для старых публикаций
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-stone-600">
            {isComplete
              ? "У опубликованных материалов уже есть SEO и alt, подготовленные автоматически или вручную."
              : isProcessing
                ? `Ожидают обработки: ${status.pending}; выполняются: ${status.running}.${remaining ? ` Осталось подготовить: ${remaining}.` : ""}`
              : `Нужно подготовить: ${remaining}. Ручные title, description и alt останутся без изменений.`}
          </p>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            {status.worker.enabled
              ? status.worker.processing
                ? "Сервер проверяет и обрабатывает очередь. Вкладку можно закрыть."
                : "Автообработка включена: проверка каждые 30 секунд, задачи выполняются по очереди."
              : "Постоянный серверный обработчик не включён."}
            {status.worker.lastCheckedAt ? ` Последняя успешная проверка: ${new Date(status.worker.lastCheckedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК.` : ""}
          </p>
          {status.worker.error ? (
            <p className="mt-1 text-sm leading-6 text-amber-700">
              {status.worker.error}
              {status.worker.nextCheckAt ? ` Следующая попытка: ${new Date(status.worker.nextCheckAt).toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow" })} МСК.` : ""}
            </p>
          ) : null}
          {status.review || status.failed ? (
            <p className="mt-1 text-sm leading-6 text-amber-700">
              Требуют проверки: {status.review}; завершились ошибкой: {status.failed}.
              Эти задачи не запускаются повторно кнопкой обработки очереди.
            </p>
          ) : null}
          {refreshError ? (
            <p className="mt-1 text-sm text-amber-700" role="status">
              Не удалось обновить статус. Показаны последние полученные данные.
            </p>
          ) : null}
          {message ? (
            <p className="mt-2 text-sm leading-5 text-stone-500" role="status">
              {message}
            </p>
          ) : null}
        </div>
        {!isComplete && !isProcessing ? (
          <button
            type="button"
            disabled={working}
            onClick={() => void start()}
            className="shrink-0 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:opacity-55"
          >
            {working ? "Подготавливаем…" : "Подготовить автоматически"}
          </button>
        ) : isProcessing ? (
          <button
            type="button"
            disabled={working || (status.worker.enabled && status.worker.processing)}
            onClick={() => void processNow()}
            className="shrink-0 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-55"
          >
            {working ? "Запускаем…" : status.worker.enabled
              ? status.worker.processing ? "Очередь обрабатывается…" : "Обработать всю очередь"
              : "Обработать следующую"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
