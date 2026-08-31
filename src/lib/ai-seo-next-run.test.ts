// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  aiSeoJob: { findFirst: vi.fn() }, aiSeoReview: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { getNextAiSeoRunAt } from "./ai-seo-next-run";
beforeEach(() => {
  db.aiSeoJob.findFirst.mockResolvedValue(null);
  db.aiSeoReview.findFirst.mockResolvedValue(null);
});

describe("таймер отложенных задач", () => {
  it("пустой очереди не назначает раннюю проверку", async () => {
    expect(await getNextAiSeoRunAt()).toBeNull();
  });
  it("берёт ближайший retry обеих очередей", async () => {
    db.aiSeoJob.findFirst.mockResolvedValueOnce({ runAfter: new Date("2026-08-31T12:03:00Z") });
    db.aiSeoReview.findFirst.mockResolvedValueOnce({ runAfter: new Date("2026-08-31T12:01:00Z") });
    expect(await getNextAiSeoRunAt()).toBe("2026-08-31T12:01:00.000Z");
  });
  it.each(["aiSeoJob", "aiSeoReview"] as const)("планирует восстановление RUNNING в %s после рестарта", async (table) => {
    db[table].findFirst.mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lockedAt: new Date("2026-08-31T12:00:00Z") });
    expect(await getNextAiSeoRunAt()).toBe("2026-08-31T12:10:00.001Z");
  });
  it("не берёт DONE/FAILED/REVIEW/READY и не читает полные записи", async () => {
    await getNextAiSeoRunAt();
    for (const table of [db.aiSeoJob, db.aiSeoReview]) {
      expect(table.findFirst.mock.calls).toEqual([
        [{ where: { status: "PENDING" }, orderBy: { runAfter: "asc" }, select: { runAfter: true } }],
        [{ where: { status: "RUNNING", lockedAt: { not: null } }, orderBy: { lockedAt: "asc" }, select: { lockedAt: true } }],
      ]);
    }
  });
});
