"use client";

import { Check, ExternalLink, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AiSeoReviewItem,
  AiSeoReviewStatus,
} from "@/lib/ai-seo-reviews";
import { SEO_REVIEW_PRIORITY, type SeoReviewPriority } from "@/lib/seo-review";

type Snapshot = {
  status: AiSeoReviewStatus;
  items: AiSeoReviewItem[];
};

type ApiResponse = Snapshot & {
  error?: string;
  stale?: boolean;
  queued?: { queued: number; skipped: number };
};

function queueableCount(bucket: AiSeoReviewStatus["critical"]) {
  return Math.max(0, bucket.unresolved - bucket.pending - bucket.running - bucket.ready);
}

function priorityLabel(priority: SeoReviewPriority) {
  return priority === SEO_REVIEW_PRIORITY.CRITICAL ? "Срочно" : "Улучшить";
}

export function AiSeoReviewControl({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [loading, setLoading] = useState<SeoReviewPriority | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/seo/reviews", { cache: "no-store" });
    const next = (await response.json().catch(() => null)) as Snapshot | null;
    if (response.ok && next) setSnapshot(next);
  }, []);

  const pending = snapshot.status.critical.pending + snapshot.status.improve.pending;
  const running = snapshot.status.critical.running + snapshot.status.improve.running;
  const failed = snapshot.status.critical.failed + snapshot.status.improve.failed;
  useEffect(() => {
    if (!pending && !running) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [pending, refresh, running]);

  const criticalQueueable = queueableCount(snapshot.status.critical);
  const improveQueueable = queueableCount(snapshot.status.improve);
  const readyItems = useMemo(
    () => snapshot.items.filter((item) => item.status === "READY"),
    [snapshot.items],
  );

  const queue = useCallback(async (priority: SeoReviewPriority) => {
    const count = priority === SEO_REVIEW_PRIORITY.CRITICAL
      ? criticalQueueable
      : improveQueueable;
    if (!count) return;
    const label = priority === SEO_REVIEW_PRIORITY.CRITICAL ? "срочных" : "следующих";
    if (
      !window.confirm(
        `Подготовить варианты SEO для ${count} ${label} материалов? Текущие title и description не изменятся.`,
      )
    ) {
      return;
    }
    setLoading(priority);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/seo/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue", priority }),
      });
      const data = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Не удалось подготовить варианты");
      setSnapshot({ status: data.status, items: data.items });
      setMessage(
        data.queued?.queued
          ? "Варианты готовятся на сервере — вкладку можно закрыть."
          : "Для этих материалов уже есть актуальные варианты.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подготовить варианты");
    } finally {
      setLoading(null);
    }
  }, [criticalQueueable, improveQueueable]);

  const processNow = useCallback(async () => {
    if (
      !window.confirm(
        "Подготовить следующий вариант SEO сейчас? Текущие title и description не изменятся.",
      )
    ) {
      return;
    }
    setLoading(SEO_REVIEW_PRIORITY.CRITICAL);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/seo/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process" }),
      });
      const data = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Не удалось обработать очередь");
      setSnapshot({ status: data.status, items: data.items });
      setMessage("Очередь обработана. Готовые варианты появились ниже.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обработать очередь");
    } finally {
      setLoading(null);
    }
  }, []);

  const act = useCallback(async (id: string, action: "apply" | "dismiss") => {
    if (action === "apply" && !window.confirm("Применить предложенные title и description к опубликованной странице?")) {
      return;
    }
    setActionId(id);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/seo/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Не удалось обновить предложение");
      setSnapshot({ status: data.status, items: data.items });
      setMessage(
        action === "apply" ? "SEO-поля обновлены." : "Текущий текст оставлен без изменений.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обновить предложение");
    } finally {
      setActionId(null);
    }
  }, []);

  const total = snapshot.status.critical.total + snapshot.status.improve.total;
  if (!total && !snapshot.items.length) return null;

  return (
    <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-stone-900">
            <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
            Улучшить существующее SEO
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-stone-600">
            AI предложит текст по публикации, рубрике, подборке и alt изображений. Он не заменит
            ваши поля, пока вы сами не нажмёте «Применить».
          </p>
          <p className="mt-2 text-sm leading-5 text-stone-500">
            {snapshot.status.critical.unresolved
              ? `${snapshot.status.critical.unresolved} срочно: общий или повторяющийся title.`
              : "Срочных проблем не осталось."}
            {snapshot.status.improve.unresolved
              ? ` Ещё ${snapshot.status.improve.unresolved} материалов можно улучшить позже.`
              : ""}
          </p>
          {message ? <p className="mt-2 text-sm leading-5 text-stone-500" role="status">{message}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {criticalQueueable ? (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void queue(SEO_REVIEW_PRIORITY.CRITICAL)}
              className="rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:opacity-55"
            >
              {loading === SEO_REVIEW_PRIORITY.CRITICAL
                ? "Готовим…"
                : `Предложить ${criticalQueueable} срочных`}
            </button>
          ) : null}
          {improveQueueable ? (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void queue(SEO_REVIEW_PRIORITY.IMPROVE)}
              className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-55"
            >
              {loading === SEO_REVIEW_PRIORITY.IMPROVE
                ? "Готовим…"
                : `Улучшить ещё ${improveQueueable}`}
            </button>
          ) : null}
          {pending || running ? (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void processNow()}
              className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-55"
            >
              {loading ? "Готовим…" : "Обработать следующий"}
            </button>
          ) : null}
        </div>
      </div>

      {pending || running ? (
        <p className="mt-4 rounded-2xl bg-stone-50 px-3 py-2.5 text-sm leading-5 text-stone-600">
          {pending + running} вариантов готовятся в фоне. Вкладку можно закрыть.
        </p>
      ) : null}
      {failed ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-800">
          Для {failed} вариантов AI трижды не смог подготовить текст. Повторить можно кнопкой
          «Предложить».
        </p>
      ) : null}

      {readyItems.length ? (
        <div className="mt-5 space-y-3 border-t border-stone-100 pt-5">
          <h3 className="text-sm font-medium text-stone-800">Готовые варианты</h3>
          {readyItems.map((item) => (
            <article key={item.id} className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.priority === SEO_REVIEW_PRIORITY.CRITICAL ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                    {priorityLabel(item.priority)}
                  </span>
                  <p className="mt-2 text-sm font-medium text-stone-900">{item.label}</p>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-stone-500 underline underline-offset-2 hover:text-stone-800">
                      Открыть страницу <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actionId !== null || item.stale}
                    onClick={() => void act(item.id, "apply")}
                    className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Применить
                  </button>
                  <button
                    type="button"
                    disabled={actionId !== null}
                    onClick={() => void act(item.id, "dismiss")}
                    className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Оставить
                  </button>
                </div>
              </div>
              {item.stale ? (
                <p className="mt-3 text-sm leading-5 text-amber-800">Текст материала изменился — сначала подготовьте новый вариант.</p>
              ) : (
                <div className="mt-4 grid gap-3 text-sm leading-5 sm:grid-cols-2">
                  <div className="rounded-xl bg-white p-3 text-stone-500">
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Сейчас</p>
                    <p className="mt-1 font-medium text-stone-700">{item.currentTitle || "—"}</p>
                    <p className="mt-1.5">{item.currentDescription || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-stone-700">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Предложение AI</p>
                    <p className="mt-1 font-medium">{item.suggestedTitle}</p>
                    <p className="mt-1.5">{item.suggestedDescription}</p>
                  </div>
                </div>
              )}
              {item.flags.length ? <p className="mt-3 text-xs leading-5 text-stone-500">Причина: {item.flags.join(" · ")}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
