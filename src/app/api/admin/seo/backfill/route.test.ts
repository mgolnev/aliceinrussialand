// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(), status: vi.fn(), process: vi.fn(), wake: vi.fn(), worker: vi.fn(), after: vi.fn(),
}));
vi.mock("@/lib/ai-seo-jobs", () => ({
  enqueuePublishedPostsAiSeoBackfill: mocks.enqueue,
  getAiSeoBackfillStatus: mocks.status,
  processAiSeoJobs: mocks.process,
}));
vi.mock("@/lib/ai-seo-worker", () => ({ wakeAiSeoWorker: mocks.wake, getAiSeoWorkerStatus: mocks.worker }));
vi.mock("next/server", async (importOriginal) => ({ ...await importOriginal<object>(), after: mocks.after }));
import { GET, POST } from "./route";
const request = (mode: string) => new Request(`http://localhost/api/admin/seo/backfill?mode=${mode}`, { method: "POST" });

beforeEach(() => {
  mocks.status.mockResolvedValue({ pending: 7, running: 0 });
  mocks.wake.mockReturnValue(true);
  mocks.enqueue.mockResolvedValue({ jobs: 7, posts: 1 });
  mocks.worker.mockReturnValue({ error: "worker disabled" });
});

describe("ручная обработка всей очереди", () => {
  it("возвращает 202, будит worker и не пересоздаёт накопленные задачи", async () => {
    const res = await POST(request("process-all"));
    expect(res.status).toBe(202);
    expect((await res.json()).status.pending).toBe(7);
    expect(mocks.wake).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("не обещает фоновую обработку, когда worker выключен", async () => {
    mocks.wake.mockReturnValue(false);
    const res = await POST(request("process-all"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("worker disabled");
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("после постановки новых задач будит тот же worker", async () => {
    expect((await POST(request("start"))).status).toBe(200);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.wake).toHaveBeenCalledTimes(1);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("сохраняет after для serverless и ручной режим одной задачи", async () => {
    mocks.wake.mockReturnValue(false);
    await POST(request("start"));
    expect(mocks.after).toHaveBeenCalledTimes(1);
    await POST(request("process"));
    expect(mocks.process).toHaveBeenCalledWith({ limit: 1 });
  });

  it("отклоняет неизвестный режим без постановки/обработки задач", async () => {
    expect((await POST(request("typo"))).status).toBe(400);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.wake).not.toHaveBeenCalled();
  });

  it("запрос статуса не запускает обработку и не кешируется", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.wake).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });
});
