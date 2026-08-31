import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAiSeoJobs } from "@/lib/ai-seo-jobs";
import { getNextAiSeoRunAt } from "@/lib/ai-seo-next-run";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !provided) return false;
  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

/** Внешний планировщик (Amvera Cron Jobs): страховка для задач, которые не успел выполнить `after`. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  // Один запрос к модели может занять до 45 секунд, а маршрут ограничен 60
  // секундами. Обрабатываем ровно одну задачу: workflow вызывает маршрут дважды,
  // поэтому очередь продолжает двигаться без зависших RUNNING-задач.
  const result = await processAiSeoJobs({ limit: 1 });
  const nextRunAt = result.claimed === 0 ? await getNextAiSeoRunAt() : null;
  return NextResponse.json({ ok: true, ...result, nextRunAt }, { headers });
}

/** Внутренний worker использует POST: обработка не должна попадать в HTTP-кеш. */
export const POST = GET;
