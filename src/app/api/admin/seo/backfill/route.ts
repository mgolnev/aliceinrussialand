import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  enqueuePublishedPostsAiSeoBackfill,
  getAiSeoBackfillStatus,
  processAiSeoJobs,
} from "@/lib/ai-seo-jobs";
import { getAiSeoWorkerStatus, wakeAiSeoWorker } from "@/lib/ai-seo-worker";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Короткий status-запрос для индикатора в админке. */
export async function GET() {
  return NextResponse.json(await getAiSeoBackfillStatus(), { headers });
}

/**
 * Безопасный разовый запуск для старых публикаций. `start` лишь ставит задачи
 * в устойчивую очередь. `process-all` будит последовательный серверный цикл,
 * а `process` оставлен как запасной режим одной задачи для serverless.
 */
export async function POST(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") ?? "start";

  if (!["start", "process", "process-all"].includes(mode)) {
    return NextResponse.json({ error: "Неизвестный режим обработки" }, { status: 400, headers });
  }

  if (mode === "process-all") {
    if (!wakeAiSeoWorker()) {
      return NextResponse.json({ error: getAiSeoWorkerStatus().error }, { status: 503, headers });
    }
    return NextResponse.json({ ok: true, status: await getAiSeoBackfillStatus() }, { status: 202, headers });
  }

  if (mode === "process") {
    const processed = await processAiSeoJobs({ limit: 1 });
    return NextResponse.json({
      ok: true,
      processed,
      status: await getAiSeoBackfillStatus(),
    }, { headers });
  }

  const queued = await enqueuePublishedPostsAiSeoBackfill();
  if (queued.jobs && !wakeAiSeoWorker()) {
    after(async () => {
      await processAiSeoJobs({ limit: 1 });
    });
  }
  return NextResponse.json({
    ok: true,
    queued,
    status: await getAiSeoBackfillStatus(),
  }, { headers });
}
