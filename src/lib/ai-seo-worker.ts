import type { AiSeoProcessSummary } from "@/lib/ai-seo-jobs";

const IDLE_DELAY_MS = 12 * 60 * 60_000;
const ERROR_RETRY_MS = 30_000;
const JOB_DELAY_MS = 250;
const REQUEST_TIMEOUT_MS = 120_000;
const LOCK_RECOVERY_MS = 10 * 60_000;

export type AiSeoWorkerResult = AiSeoProcessSummary & { nextRunAt?: string | null };

export type AiSeoWorkerStatus = {
  enabled: boolean;
  processing: boolean;
  lastCheckedAt: string | null;
  lastCompletedAt: string | null;
  nextCheckAt: string | null;
  error: string | null;
};

/** Один последовательный цикл на Node-процесс. Сами задачи и блокировки — в БД. */
export class AiSeoWorker {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private blockedUntil = 0;
  private wakePending = false;
  private state: AiSeoWorkerStatus = {
    enabled: true,
    processing: false,
    lastCheckedAt: null,
    lastCompletedAt: null,
    nextCheckAt: null,
    error: null,
  };

  constructor(private readonly runOne: () => Promise<AiSeoWorkerResult>) {}

  status(): AiSeoWorkerStatus {
    return { ...this.state };
  }

  start() {
    if (!this.stopped && !this.timer && !this.state.processing) this.schedule(5_000);
  }

  /** Повторное нажатие не создаёт второй цикл и не сбрасывает попытки задач. */
  wake() {
    if (this.stopped) return;
    if (this.state.processing) {
      // Новая задача могла появиться уже после чтения пустой очереди текущим запросом.
      this.wakePending = true;
      return;
    }
    this.schedule(Math.max(0, this.blockedUntil - Date.now()));
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.state.nextCheckAt = null;
  }

  private schedule(delay: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.state.nextCheckAt = new Date(Date.now() + delay).toISOString();
    this.timer = setTimeout(() => void this.tick(), delay);
    this.timer.unref?.();
  }

  private async tick() {
    this.timer = null;
    this.state.nextCheckAt = null;
    if (this.stopped || this.state.processing) return;
    this.state.processing = true;
    this.wakePending = false;
    let delay = IDLE_DELAY_MS;
    try {
      const result = await this.runOne();
      this.state.lastCheckedAt = new Date().toISOString();
      this.state.error = null;
      this.blockedUntil = 0;
      if (result.done || result.review) this.state.lastCompletedAt = this.state.lastCheckedAt;
      // Не ждём следующего тика расписания между задачами накопленной пачки.
      if (result.claimed > 0 || this.wakePending) delay = JOB_DELAY_MS;
      else if (result.nextRunAt) {
        // Ставим один таймер на известный retry/истечение lease, без частого опроса БД.
        const nextRun = Date.parse(result.nextRunAt);
        if (Number.isFinite(nextRun)) delay = Math.min(IDLE_DELAY_MS, Math.max(1_000, nextRun - Date.now()));
      }
    } catch (error) {
      const timedOut = error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      // HTTP-таймаут не гарантирует остановку запроса к модели на сервере.
      // До истечения lease не запускаем новую цепочку даже по ручной кнопке.
      delay = timedOut ? LOCK_RECOVERY_MS : ERROR_RETRY_MS;
      this.blockedUntil = Date.now() + delay;
      this.state.error = timedOut
        ? "Обработчик не ответил вовремя. Повтор после восстановления блокировки задачи."
        : "Не удалось вызвать обработчик очереди. Повтор запланирован автоматически.";
      // Не логируем response body, URL или исключение: там могут оказаться секреты.
      console.error("[ai-seo-worker]", this.state.error);
    } finally {
      this.state.processing = false;
      this.schedule(delay);
    }
  }
}

// Instrumentation и Route Handlers могут быть разными bundle-модулями.
// Singleton хранит лишь цикл/телеметрию; незавершённая очередь переживает рестарт в БД.
const workerGlobal = globalThis as typeof globalThis & { aiSeoWorker?: AiSeoWorker };

function disabledReason(): string | null {
  if (process.env.VERCEL || process.env.AI_SEO_WORKER_ENABLED !== "true" ||
      process.env.NEXT_PHASE === "phase-production-build") {
    return "Серверная обработка пачки не включена. Доступны внешний cron и обработка по одной задаче.";
  }
  if (!process.env.CRON_SECRET?.trim()) return "Для серверного обработчика не задан CRON_SECRET.";
  return null;
}

async function runOneLocally(): Promise<AiSeoWorkerResult> {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid server port");
  // Loopback, без CDN. Отдельный HTTP-запрос сохраняет Next request context,
  // необходимый для revalidatePath/revalidateTag после записи AI-результатов.
  const response = await fetch(`http://127.0.0.1:${port}/api/cron/seo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET?.trim()}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("SEO worker request failed");
  const result = await response.json();
  if (result?.ok !== true || !["claimed", "done", "review", "retrying", "failed"].every(
    (key) => Number.isInteger(result[key]) && result[key] >= 0,
  )) throw new Error("Invalid SEO worker response");
  if (result.nextRunAt != null && (typeof result.nextRunAt !== "string" ||
      !Number.isFinite(Date.parse(result.nextRunAt)))) throw new Error("Invalid SEO worker schedule");
  return result;
}

export function startAiSeoWorker(): AiSeoWorker | null {
  if (disabledReason()) return null;
  const worker = workerGlobal.aiSeoWorker ??= new AiSeoWorker(runOneLocally);
  worker.start();
  return worker;
}

export function wakeAiSeoWorker(): boolean {
  const worker = startAiSeoWorker();
  worker?.wake();
  return Boolean(worker);
}

export function getAiSeoWorkerStatus(): AiSeoWorkerStatus {
  const reason = disabledReason();
  if (!reason && workerGlobal.aiSeoWorker) return workerGlobal.aiSeoWorker.status();
  return {
    enabled: false,
    processing: false,
    lastCheckedAt: null,
    lastCompletedAt: null,
    nextCheckAt: null,
    error: reason ?? "Серверный обработчик ещё не запущен.",
  };
}
