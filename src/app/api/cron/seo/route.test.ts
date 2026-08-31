// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const processJobs = vi.hoisted(() => vi.fn());
const nextRun = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai-seo-jobs", () => ({ processAiSeoJobs: processJobs }));
vi.mock("@/lib/ai-seo-next-run", () => ({ getNextAiSeoRunAt: nextRun }));
import { GET, POST } from "./route";
afterEach(() => vi.unstubAllEnvs());

describe("защищённый обработчик SEO", () => {
  it.each([GET, POST])("GET/POST требуют правильный секрет", async (handler) => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    for (const authorization of ["", "Bearer wrong", "Bearer test-secreu"]) {
      const response = await handler(new Request("http://localhost/api/cron/seo", { headers: { authorization } }));
      expect(response.status).toBe(401);
    }
    expect(processJobs).not.toHaveBeenCalled();
  });

  it.each([GET, POST])("GET/POST обрабатывают ровно одну задачу без кеширования", async (handler) => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    processJobs.mockResolvedValue({ claimed: 1, done: 1 });
    const response = await handler(new Request("http://localhost/api/cron/seo", {
      headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(processJobs).toHaveBeenCalledWith({ limit: 1 });
    expect(await response.json()).toEqual({ ok: true, claimed: 1, done: 1, nextRunAt: null });
    expect(nextRun).not.toHaveBeenCalled();
  });

  it("после пустого прохода возвращает время известной отложенной задачи", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    processJobs.mockResolvedValue({ claimed: 0, done: 0 });
    nextRun.mockResolvedValue("2026-08-31T12:01:00Z");
    const response = await POST(new Request("http://localhost/api/cron/seo", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    }));
    expect((await response.json()).nextRunAt).toBe("2026-08-31T12:01:00Z");
    expect(nextRun).toHaveBeenCalledTimes(1);
  });
});
