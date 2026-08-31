import { prisma } from "@/lib/prisma";

/** Вызывается только в конце прохода: когда сейчас больше нечего взять. */
export async function getNextAiSeoRunAt(): Promise<string | null> {
  const pendingQuery = {
    where: { status: "PENDING" },
    orderBy: { runAfter: "asc" as const },
    select: { runAfter: true },
  };
  const runningQuery = {
    where: { status: "RUNNING", lockedAt: { not: null } },
    orderBy: { lockedAt: "asc" as const },
    select: { lockedAt: true },
  };
  const [job, review, runningJob, runningReview] = await Promise.all([
    prisma.aiSeoJob.findFirst(pendingQuery),
    prisma.aiSeoReview.findFirst(pendingQuery),
    prisma.aiSeoJob.findFirst(runningQuery),
    prisma.aiSeoReview.findFirst(runningQuery),
  ]);
  const dates = [
    job?.runAfter?.getTime(),
    review?.runAfter?.getTime(),
    // Восстановление использует строгое lt, поэтому добавляем 1 мс.
    runningJob?.lockedAt ? runningJob.lockedAt.getTime() + 10 * 60_000 + 1 : undefined,
    runningReview?.lockedAt ? runningReview.lockedAt.getTime() + 10 * 60_000 + 1 : undefined,
  ].filter((date): date is number => date !== undefined);
  return dates.length ? new Date(Math.min(...dates)).toISOString() : null;
}
