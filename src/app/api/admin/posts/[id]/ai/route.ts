import { after } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import {
  enqueuePublishedPostAiSeo,
  processAiSeoJobs,
} from "@/lib/ai-seo-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Редкая ручная кнопка: переподготавливает автоматические поля, но не ручные. */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!post) return NextResponse.json({ error: "Пост не найден" }, { status: 404 });
  if (post.status !== POST_STATUS.PUBLISHED) {
    return NextResponse.json(
      { error: "Сначала опубликуйте пост — SEO готовится только для видимых страниц." },
      { status: 409 },
    );
  }

  const queued = await enqueuePublishedPostAiSeo(id, {
    metadata: true,
    forceImages: true,
  });
  if (queued.jobIds.length) {
    after(async () => {
      await processAiSeoJobs({ jobIds: queued.jobIds, limit: 2 });
    });
  }
  return NextResponse.json({ queued: queued.jobIds.length });
}
