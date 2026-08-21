import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAiSeoJobs } from "@/lib/ai-seo-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Один плановый вызов берёт небольшую безопасную порцию. GitHub Actions
  // обращается дважды за запуск, чтобы не упираться в лимит 60 секунд маршрута.
  const result = await processAiSeoJobs({ limit: 6 });
  return NextResponse.json({ ok: true, ...result });
}
