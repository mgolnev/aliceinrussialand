"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type AiSeoBackfillSnapshot = {
  postsNeedingSeo: number;
  imagesNeedingAlt: number;
  pending: number;
  running: number;
  review: number;
  failed: number;
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

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/admin/seo/backfill", { cache: "no-store" });
    const next = (await res.json().catch(() => null)) as AiSeoBackfillSnapshot | null;
    if (res.ok && next) setStatus(next);
  }, []);

  const isProcessing = status.pending > 0 || status.running > 0;
  useEffect(() => {
    if (!isProcessing) return;
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 10_000);
    return () => window.clearInterval(timer);
  }, [isProcessing, refreshStatus]);

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
      setMessage(
        "Задачи сохранены. Обработка продолжится на сервере — вкладку можно закрыть.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось запустить подготовку SEO");
    } finally {
      setWorking(false);
    }
  }, [status.imagesNeedingAlt, status.postsNeedingSeo]);

  const remaining = remainingText(status);
  const isComplete = !status.postsNeedingSeo && !status.imagesNeedingAlt;

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
                ? `В очереди: ${remaining}. Обработка продолжается на сервере, вкладку можно закрыть.`
              : `Нужно подготовить: ${remaining}. Ручные title, description и alt останутся без изменений.`}
          </p>
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
        ) : null}
      </div>
    </section>
  );
}
