// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiSeoWorker, getAiSeoWorkerStatus, startAiSeoWorker, wakeAiSeoWorker } from "./ai-seo-worker";

const empty = { claimed: 0, done: 0, review: 0, retrying: 0, failed: 0 };
const done = { ...empty, claimed: 1, done: 1 };
let worker: AiSeoWorker | null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-31T12:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  worker?.stop();
  worker = null;
  Reflect.deleteProperty(globalThis, "aiSeoWorker");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("последовательный серверный worker", () => {
  it("автоматически запускается и обрабатывает всю пачку, а не одну задачу", async () => {
    const run = vi.fn().mockResolvedValue(empty)
      .mockResolvedValueOnce(done).mockResolvedValueOnce(done).mockResolvedValueOnce(done);
    worker = new AiSeoWorker(run);
    worker.start();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(751);
    expect(run).toHaveBeenCalledTimes(4);
    expect(worker.status()).toMatchObject({ processing: false, error: null });
    expect(worker.status().lastCompletedAt).not.toBeNull();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(5);
  });

  it("ручной запуск не ждёт расписания; повторные нажатия не создают параллельных запросов", async () => {
    let finish!: (value: typeof done) => void;
    const run = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValue(empty);
    worker = new AiSeoWorker(run);
    worker.start();
    worker.wake();
    worker.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(worker.status().processing).toBe(true);
    worker.wake();
    worker.start();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(run).toHaveBeenCalledTimes(1);
    finish(done);
    await vi.advanceTimersByTimeAsync(250);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("продолжает после retry/review/failed и ждёт, если доступных задач больше нет", async () => {
    const run = vi.fn().mockResolvedValue(empty)
      .mockResolvedValueOnce({ ...empty, claimed: 1, retrying: 1 })
      .mockResolvedValueOnce({ ...empty, claimed: 1, review: 1 })
      .mockResolvedValueOnce({ ...empty, claimed: 1, failed: 1 });
    worker = new AiSeoWorker(run);
    worker.wake();
    await vi.advanceTimersByTimeAsync(750);
    expect(run).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(run).toHaveBeenCalledTimes(4);
    // Имитация новой или отложенной задачи, которая стала доступна в БД.
    run.mockResolvedValueOnce(done);
    await vi.advanceTimersByTimeAsync(251);
    expect(run).toHaveBeenCalledTimes(6);
  });

  it("восстанавливается после недоступности сервера и не публикует текст исключения", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("Bearer TOP-SECRET"))
      .mockResolvedValue(empty);
    worker = new AiSeoWorker(run);
    worker.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(worker.status().error).toContain("Повтор запланирован");
    expect(JSON.stringify(worker.status())).not.toContain("TOP-SECRET");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("TOP-SECRET");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(worker.status().error).toBeNull();
  });

  it("после неоднозначного таймаута не начинает новый проход до восстановления lease", async () => {
    const run = vi.fn().mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
      .mockResolvedValue(empty);
    worker = new AiSeoWorker(run);
    worker.wake();
    await vi.advanceTimersByTimeAsync(0);
    worker.wake();
    await vi.advanceTimersByTimeAsync(599_999);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("остановка не оставляет таймер и не перезапускает цикл по завершении текущего запроса", async () => {
    let finish!: (value: typeof done) => void;
    const run = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    worker = new AiSeoWorker(run);
    worker.wake();
    await vi.advanceTimersByTimeAsync(0);
    worker.stop();
    finish(done);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(worker.status().nextCheckAt).toBeNull();
  });
});

describe("конфигурация постоянного Node-процесса", () => {
  beforeEach(() => {
    vi.stubEnv("AI_SEO_WORKER_ENABLED", "true");
    vi.stubEnv("CRON_SECRET", " test-server-secret ");
    vi.stubEnv("PORT", "3456");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NEXT_PHASE", "");
  });

  it.each([
    ["AI_SEO_WORKER_ENABLED", "false"],
    ["VERCEL", "1"],
    ["NEXT_PHASE", "phase-production-build"],
    ["CRON_SECRET", " "],
  ])("не стартует при %s=%s", (key, value) => {
    vi.stubEnv(key, value);
    expect(startAiSeoWorker()).toBeNull();
    expect(wakeAiSeoWorker()).toBe(false);
    expect(getAiSeoWorkerStatus().enabled).toBe(false);
  });

  it("использует один singleton, локальный POST, секрет и отключённый кеш", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true, ...empty }));
    vi.stubGlobal("fetch", fetchMock);
    worker = startAiSeoWorker();
    expect(startAiSeoWorker()).toBe(worker);
    expect(wakeAiSeoWorker()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3456/api/cron/seo", expect.objectContaining({
      method: "POST", cache: "no-store", redirect: "error",
      headers: { Authorization: "Bearer test-server-secret" },
    }));
    expect(getAiSeoWorkerStatus().lastCheckedAt).not.toBeNull();
    expect(JSON.stringify(getAiSeoWorkerStatus())).not.toContain("test-server-secret");
  });

  it.each([401, 500, 200])("отличает ошибку HTTP %i/неверный ответ от пустой очереди", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: false }, { status })));
    worker = startAiSeoWorker();
    wakeAiSeoWorker();
    await vi.advanceTimersByTimeAsync(0);
    expect(getAiSeoWorkerStatus().error).not.toBeNull();
    expect(getAiSeoWorkerStatus().lastCheckedAt).toBeNull();
  });
});
