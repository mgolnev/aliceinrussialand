import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  enqueuePublishedPostsAiSeoBackfill,
  getAiSeoBackfillStatus,
  processAiSeoJobs,
} from "@/lib/ai-seo-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Короткий status-запрос для индикатора в админке. */
export async function GET() {
  return NextResponse.json(await getAiSeoBackfillStatus());
}

/**
 * Безопасный разовый запуск для старых публикаций. `start` лишь ставит задачи
 * в устойчивую очередь, а `process` позволяет вкладке аккуратно продолжить
 * обработку небольшими порциями без ожидания одного длинного HTTP-запроса.
 */
export async function POST(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") ?? "start";

  if (mode === "process") {
    const processed = await processAiSeoJobs({ limit: 1 });
    return NextResponse.json({
      ok: true,
      processed,
      status: await getAiSeoBackfillStatus(),
    });
  }

  const queued = await enqueuePublishedPostsAiSeoBackfill();
  if (queued.jobs) {
    after(async () => {
      await processAiSeoJobs({ limit: 1 });
    });
  }
  return NextResponse.json({
    ok: true,
    queued,
    status: await getAiSeoBackfillStatus(),
  });
}
