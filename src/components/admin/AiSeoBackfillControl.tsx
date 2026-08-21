"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";

export type AiSeoBackfillSnapshot = {
  postsNeedingSeo: number;
  imagesNeedingAlt: number;
  pending: number;
  running: number;
  review: number;
  failed: number;
};

type ProcessResponse = {
  error?: string;
  status?: AiSeoBackfillSnapshot;
  processed?: { claimed: number };
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

  const drain = useCallback(async (snapshot: AiSeoBackfillSnapshot) => {
    let current = snapshot;
    // Обрабатываем порциями: UI не зависает, а очередь можно безопасно продолжить после паузы.
    for (let round = 0; round < 120; round += 1) {
      if (current.postsNeedingSeo === 0 && current.imagesNeedingAlt === 0) {
        return current;
      }
      const res = await fetch("/api/admin/seo/backfill?mode=process", {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as ProcessResponse | null;
      if (!res.ok || !data?.status) {
        throw new Error(data?.error ?? "Не удалось продолжить подготовку SEO");
      }
      current = data.status;
      setStatus(current);
      if (data.processed?.claimed === 0 && current.running === 0) return current;
    }
    return current;
  }, []);

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
      const data = (await res.json().catch(() => null)) as ProcessResponse | null;
      if (!res.ok || !data?.status) {
        throw new Error(data?.error ?? "Не удалось поставить материалы в очередь");
      }
      setStatus(data.status);
      const finished = await drain(data.status);
      if (finished.postsNeedingSeo === 0 && finished.imagesNeedingAlt === 0) {
        setMessage("Готово: SEO и alt подготовлены для опубликованных материалов.");
      } else if (finished.review || finished.failed) {
        setMessage("Часть материалов требует повторного запуска — очередь сохранена.");
      } else {
        setMessage("Очередь сохранена. Нажмите кнопку ещё раз, чтобы продолжить.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось запустить подготовку SEO");
    } finally {
      setWorking(false);
    }
  }, [drain, status.imagesNeedingAlt, status.postsNeedingSeo]);

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
              : `Нужно подготовить: ${remaining}. Ручные title, description и alt останутся без изменений.`}
          </p>
          {message ? (
            <p className="mt-2 text-sm leading-5 text-stone-500" role="status">
              {message}
            </p>
          ) : null}
        </div>
        {!isComplete ? (
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
